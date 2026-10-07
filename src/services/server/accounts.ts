import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { paidTier } from "./billing";
import { vehicleLimit } from "@/lib/plans";
import { createClerkClient } from "@clerk/backend";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { getRequest } from "@tanstack/react-start/server";
import type { AccountState, UserAccount, AdminState, AdminUser, AdminVehicleEdit, WorkshopReview } from "@/lib/account-types";
import { applyAdminPolicy } from "./admin-policy";
import type { Modification, Role, ServiceRecord, Vehicle } from "@/lib/vault-store";
import { samples, lookupRegistration } from "./dvla";
import { mayStamp, sampleApproval, signStamp, checkStamp, referenceAction } from "./verification";
import receiptService from "@/assets/receipt-service.jpg";
import receiptBrakes from "@/assets/receipt-brakes.jpg";
import dynoSheet from "@/assets/dyno-sheet.jpg";

const development = process.env["NODE_ENV"] !== "production";
const clerk = createClerkClient({secretKey:process.env["CLERK_SECRET_KEY"] ?? ""});
export async function verifiedPhoneForUser(id:string) {
  const identity=await clerk.users.getUser(id);
  return identity.phoneNumbers.find(p=>p.verification?.status==="verified")?.phoneNumber ?? "";
}
const normalize = (value:string) => value.toUpperCase().replace(/[^A-Z0-9]/g,"");
export function signingSecret() {
  const secret=process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Workshop signing is not configured.");
  return secret;
}
export async function currentUser(): Promise<UserAccount & {dev_role:Role|null; password_hash:string|null}> {
  const request = getRequest();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || new URL(request.url).hostname;
  // TanStack has already consumed POST bodies by the time a serverFn runs.
  // Clerk only needs headers/cookies here; give it a fresh bodyless auth request.
  const authRequest = new Request(request.url,{method:"GET",headers:request.headers});
  const session = await clerk.authenticateRequest(authRequest,{publishableKey:publishableKeyFromHost(host,process.env["CLERK_PUBLISHABLE_KEY"])});
  const id = session.toAuth()?.userId;
  if (!id) throw new Error("Sign in to continue.");
  const identity = await clerk.users.getUser(id);
   const primaryEmail = identity.emailAddresses.find(e=>e.id===identity.primaryEmailAddressId);
   const email = primaryEmail?.emailAddress;
  if (!email) throw new Error("An email address is required.");
  await pool.query(`INSERT INTO user_accounts(id,email,full_name) VALUES($1,$2,$3)
    ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email`,[id,email,[identity.firstName,identity.lastName].filter(Boolean).join(" ") || email.split("@")[0]]);
   const profile = (await pool.query("SELECT * FROM user_accounts WHERE id=$1",[id])).rows[0];
   const billing = await paidTier(profile);
   return applyAdminPolicy({...profile,subscription_tier:billing.tier,billing_unavailable:billing.unavailable,email_verified:primaryEmail?.verification?.status==="verified"}, primaryEmail);
}
async function seedDevelopmentSamples() {
  if (!development) return;
  for (const [vrm,data] of Object.entries(samples)) {
    await pool.query("INSERT INTO vehicles(id,vin,vrm,data,status,is_sample) VALUES($1,$2,$1,$3,'approved',true) ON CONFLICT(vin) DO NOTHING",[vrm,data.vin,JSON.stringify(data)]);
  }
  // Idempotent, explicitly owner-logged historical sample records; old visual badges are not trusted.
  const seed = [
    {id:"sample-service",vrm:"AB14CDE",date:"2024-09-12",mileage:82100,category:"Servicing",description:"Full Service",items:["Engine oil 5W-30 (5L)","Oil filter","Air filter","Pollen filter","Labour"],garage:"Riverside Garage",cost:289,partsCost:154,labourCost:135,fluids:"Castrol Edge 5W-30 LL (VW 504.00/507.00), 4.6L",parts:[{name:"Oil filter",partNo:"Bosch F 026 407 183"},{name:"Air filter",partNo:"Mann C 30 005"},{name:"Pollen filter",partNo:"Febi Bilstein 26600"}],verified:false},
    {id:"sample-brakes",vrm:"AB14CDE",date:"2025-03-08",mileage:85340,category:"Brakes",description:"Brembo Brake Replacement",items:["Brembo front discs (pair)","Brembo front pads","Brake fluid flush (DOT 4)","Labour"],garage:"Apex Performance Ltd",cost:642,partsCost:468,labourCost:174,parts:[{name:"Front discs",partNo:"Brembo 09.C401.13"},{name:"Front pads",partNo:"Brembo P 85 153"}],verified:false},
  ];
  for(const [index,row] of seed.entries()) await pool.query(`INSERT INTO service_records(id,vehicle_id,vin,data,is_sample)
    SELECT $1,v.id,v.vin,$3,true FROM vehicles v WHERE v.vrm=$2 ON CONFLICT(id) DO NOTHING`,
    [row.id,row.vrm,JSON.stringify({...row,vin:samples[row.vrm]?.vin,physically_inspected_vin:false,image:index===0?receiptService:receiptBrakes})]);
  const mods=[
    {id:"sample-remap",vrm:"AB14CDE",name:"Stage 2 ECU Remap",category:"Engine/ECU",installDate:"2024-11-02",installMileage:83650,gains:"+53 bhp / +80 Nm",notes:"Development sample modification.",image:dynoSheet,status:"active",stage:"Stage 2",specs:"99 RON map · DPF-safe",tags:["Development sample"]},
    {id:"sample-intake",vrm:"AB14CDE",name:"Ramair Cold Air Intake",category:"Intake",installDate:"2024-10-10",installMileage:83020,gains:"+6 bhp",notes:"Removed due to intermittent MAF sensor fault.",status:"reverted",removalDate:"2024-12-20",removalMileage:84100},
  ];
  for(const mod of mods) await pool.query("INSERT INTO modifications(id,vehicle_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",[mod.id,mod.vrm,JSON.stringify(mod)]);
}
export function serviceRow(row:{data:unknown;id:string;vin?:string;physically_inspected_vin?:boolean;is_verified_stamp:boolean;stamped_by_garage_id:string|null;stamp_signature:string|null;is_sample:boolean;frozen_at?:string|null}):ServiceRecord {
  const verified=Boolean(row.is_verified_stamp && row.stamped_by_garage_id && row.stamp_signature &&
    checkStamp(row.id,row.stamped_by_garage_id,row.data,row.is_sample,row.stamp_signature,signingSecret()));
  return {...row.data as ServiceRecord,id:row.id,vin:row.vin??(row.data as ServiceRecord).vin,
    physically_inspected_vin:row.physically_inspected_vin??(row.data as ServiceRecord).physically_inspected_vin,is_verified_stamp:verified,verified,
    tier3:verified,stamped_by_garage_id:row.stamped_by_garage_id,
    stamp_signature:row.stamp_signature,is_sample:row.is_sample,frozen_at:row.frozen_at};
}
export async function accountState():Promise<AccountState> {
  const user = await currentUser();
  const { password_hash: _credentials, dev_role: _developmentRole, ...profile } = user;
  await seedDevelopmentSamples();
  const garage = user.role==="verified_garage";
   const records = await pool.query(`SELECT v.*,
    (SELECT history_snapshot FROM vehicle_transfers t WHERE t.vehicle_id=v.id AND t.previous_keeper_id=$1 ORDER BY transferred_at DESC LIMIT 1) AS archive_snapshot,
    (SELECT max(transferred_at) FROM vehicle_transfers t WHERE t.vehicle_id=v.id AND t.previous_keeper_id=$1) AS archive_cutoff
    FROM vehicles v WHERE $4 OR owner_user_id=$1 OR EXISTS(SELECT 1 FROM vehicle_transfers t WHERE t.vehicle_id=v.id AND t.previous_keeper_id=$1) OR ($2 AND (
    EXISTS(SELECT 1 FROM service_records s WHERE s.vehicle_id=v.id AND s.stamped_by_garage_id=$1) OR
    EXISTS(SELECT 1 FROM workshop_bookings b WHERE b.vehicle_id=v.id AND b.garage_user_id=$1) OR ($3 AND v.is_sample))) ORDER BY v.id`,[user.id,garage,development,user.role==="dev_admin"]);
  const ids = records.rows.map(r=>r.id);
  const [services,mods,notifications,bookings] = await Promise.all([
    pool.query("SELECT * FROM service_records WHERE vehicle_id=ANY($1::text[]) ORDER BY created_at",[ids]),
    pool.query("SELECT vehicle_id,data,frozen_at,created_at FROM modifications WHERE vehicle_id=ANY($1::text[])",[ids]),
    pool.query("SELECT id,message,read,created_at FROM account_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[user.id]),
    pool.query("SELECT b.id,v.vrm,scheduled_date::text AS date,b.notes,b.status FROM workshop_bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.garage_user_id=$1 OR $2 ORDER BY scheduled_date",[user.id,user.role==="dev_admin"]),
  ]);
  const paid = user.subscription_tier!=="free";
  const visible = (r:{vehicle_id:string;created_at:string}) => {
    const v=records.rows.find(v=>v.id===r.vehicle_id);
    return !v?.archive_cutoff || v.owner_user_id===user.id || user.role==="dev_admin" || new Date(r.created_at)<=new Date(v.archive_cutoff);
  };
  const history = services.rows.filter(visible).map(row=>{
    const record=serviceRow(row), vehicle=records.rows.find(v=>v.id===row.vehicle_id);
    const receiptAllowed=paid && (user.role==="dev_admin" || row.created_by_user_id===user.id || Boolean(vehicle?.archive_cutoff) ||
      (vehicle?.owner_user_id===user.id && !row.frozen_at));
    return {...record,has_receipt:Boolean(record.image),has_invoice:Boolean(record.invoice_data),
      image:receiptAllowed?record.image:undefined,invoice_data:receiptAllowed?record.invoice_data:undefined};
  }).map(record=> paid ? record : {...record,
    parts:record.parts?.map(p=>({...p,partNo:"••••••••"})),fluids:record.fluids?"••••••••":undefined,image:undefined,
    invoice_data:undefined,partsCost:undefined,labourCost:undefined});
  const activeIds=new Set(records.rows.filter(r=>r.owner_user_id===user.id).map(r=>String(r.id)).sort().slice(0,vehicleLimit(user)));
  return { user:{...profile,garage_verified:user.garage_verified&&(!user.is_sample||development)}, development,
    development_role:user.role==="dev_admin"?(user.dev_role??"superadmin"):development?user.dev_role:null,
    vehicles:records.rows.map(r=>({...((r.archive_snapshot&&r.owner_user_id!==user.id&&user.role!=="dev_admin")?r.archive_snapshot.vehicle:r.data),
      vrm:r.vrm,vin:r.vin,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample,public_enabled:r.public_enabled,
      keeper_changed_at:r.keeper_changed_at,access:r.archive_snapshot&&r.owner_user_id!==user.id&&user.role!=="dev_admin"?"archived":r.owner_user_id===user.id&&!activeIds.has(r.id)?"plan_locked":"active"})),
    services:history, mods:["pro_modder","god_mode"].includes(user.subscription_tier)?mods.rows.filter(visible).map(r=>({...r.data,frozen_at:r.frozen_at})):[],
    notifications:notifications.rows,bookings:bookings.rows };
}
export async function claim(input:{vrm:string;reference:string;vin?:string|undefined}) {
  await seedDevelopmentSamples();
  return (await import("./ownership")).claim(input);
}
export async function developmentRole(role:Role) {
  const user = await currentUser();
  if(user.role==="dev_admin") {
    // Only change the presentation being tested, not the administrator's real
    // permissions, workshop identity, verification or billing tier.
    await pool.query("UPDATE user_accounts SET dev_role=$1 WHERE id=$2",[role,user.id]);
    return {ok:true};
  }
  if(!development) throw new Error("Role switching is disabled outside development.");
  const tier = {Owner:"free",DIY:"pro_diy",Pro:"pro_modder",Garage:"verified_garage",superadmin:"pro_modder"}[role];
  const accountRole = role==="Garage"?"verified_garage":role==="Pro"||role==="superadmin"?"modder":"civilian";
  await pool.query(`UPDATE user_accounts SET role=$1,subscription_tier=$2,garage_verified=$3,
    garage_name=CASE WHEN garage_name='' THEN 'Sample Workshop' ELSE garage_name END,
    garage_registration=CASE WHEN garage_registration='' THEN 'SAMPLE-VAT-000' ELSE garage_registration END,vat_verified=$3,
    status='approved',is_sample=true,dev_role=$4 WHERE id=$5`,[accountRole,tier,role==="Garage",role,user.id]);
  return {ok:true};
}
export async function updateAccount(input:{full_name:string;garage_name:string;garage_registration:string;workshop_type?:"garage"|"specialist"|undefined}) {
  const user = await currentUser();
  // Changing workshop identity invalidates live verification; sample approval stays explicit in development.
  await pool.query(`UPDATE user_accounts SET full_name=$1,garage_name=$2,garage_registration=$3,
    garage_verified=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN garage_verified ELSE false END,
    vat_verified=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN vat_verified ELSE false END,
    status=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN status ELSE 'pending' END,
    workshop_type=$6 WHERE id=$5`,
    [input.full_name,input.garage_name,input.garage_registration,development,user.id,input.workshop_type??"garage"]);
  return {ok:true};
}
export async function createService(input:Omit<ServiceRecord,"id"|"verified">) {
  const user = await currentUser(), vrm=normalize(input.vrm);
  return transaction(async db=>{
  const row = (await db.query("SELECT * FROM vehicles WHERE vrm=$1 FOR UPDATE",[vrm])).rows[0];
  if(!row) throw new Error(`No vehicle passport found for ${vrm}.`);
  const admin=user.role==="dev_admin", workshop=admin||Boolean(user.role==="verified_garage"&&user.garage_verified&&user.vat_verified&&user.subscription_tier==="verified_garage");
  if(workshop && !admin && (!user.vat_verified || user.subscription_tier!=="verified_garage" || !mayStamp({role:user.role,verified:user.garage_verified,status:user.status,garageSample:user.is_sample,vehicleSample:row.is_sample,development}))) throw new Error("An approved VAT-verified workshop and an active Workshop subscription are required to sign records.");
  if(!workshop && row.owner_user_id!==user.id) throw new Error("Only the owner can add a DIY record.");
  if(!workshop && (input.image || input.invoice_data) && user.subscription_tier==="free") throw new Error("Pro DIY is required for receipt uploads.");
  if(!workshop && user.role!=="dev_admin") {
    const owned=await pool.query("SELECT id FROM vehicles WHERE owner_user_id=$1 ORDER BY id",[user.id]);
    if(owned.rows.findIndex(v=>v.id===row.id)>=vehicleLimit(user)) throw new Error("This vehicle is outside your active plan limit. Upgrade to Collector for three vehicles.");
  }
  const id=randomUUID(), sample=Boolean(row.is_sample||user.is_sample);
  const data={...input,vrm,vin:row.vin,physically_inspected_vin:Boolean(input.physically_inspected_vin),id,garage:admin?"V5Vault administrator":workshop?user.garage_name:"Owner logged",
    stamp_authority:admin?"administrator":workshop?"workshop":undefined,vat_verified:!admin&&workshop&&Boolean(user.vat_verified),
    verified:workshop,tier3:workshop,is_sample:sample,status:"approved"};
  const signature=workshop?signStamp(id,user.id,data,sample,signingSecret()):null;
  const saved = await db.query(`INSERT INTO service_records(id,vehicle_id,vin,physically_inspected_vin,created_by_user_id,data,is_verified_stamp,stamped_by_garage_id,stamp_signature,is_sample)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 FROM vehicles WHERE id=$2 AND vin=$3 AND ($7 OR owner_user_id=$5) RETURNING id`,
    [id,row.id,row.vin,data.physically_inspected_vin,user.id,JSON.stringify(data),workshop,workshop?user.id:null,signature,sample]);
  if(!saved.rowCount) throw new Error("Ownership changed. Reload your account before adding a record.");
  return serviceRow({id,data,is_verified_stamp:workshop,stamped_by_garage_id:workshop?user.id:null,stamp_signature:signature,is_sample:sample});
  });
}
export async function markRead() {
  const user=await currentUser(); await pool.query("UPDATE account_notifications SET read=true WHERE user_id=$1",[user.id]);return {ok:true};
}
export async function requireGarage() {
  const user=await currentUser();
  if(user.role!=="dev_admin" && (user.role!=="verified_garage" || !user.garage_verified || !user.vat_verified || user.subscription_tier!=="verified_garage" || user.status!=="approved" || (user.is_sample&&!development))) throw new Error("A VAT-verified Workshop account with an active subscription is required.");
  return user;
}
export async function book(input:{vrm:string;date:string;notes:string}) {
  const user=await requireGarage(),vrm=normalize(input.vrm);
  const vehicle=(await pool.query("SELECT * FROM vehicles WHERE vrm=$1",[vrm])).rows[0];
  if(!vehicle || (user.role!=="dev_admin"&&user.is_sample&&!vehicle.is_sample)) throw new Error("A sample workshop can only book sample passports.");
  await pool.query("INSERT INTO workshop_bookings(id,garage_user_id,vehicle_id,scheduled_date,notes) VALUES($1,$2,$3,$4,$5)",[randomUUID(),user.id,vehicle.id,input.date,input.notes]);
  return {ok:true};
}
export async function bookingStatus(id:string,status:string) {
  const user=await requireGarage();
  const result=await pool.query("UPDATE workshop_bookings SET status=$1 WHERE id=$2 AND (garage_user_id=$3 OR $4) RETURNING id",[status,id,user.id,user.role==="dev_admin"]);
  if(!result.rowCount) throw new Error("Booking not found.");
  return {ok:true};
}
export async function addModification(input:Omit<Modification,"id"|"status">) {
  const user=await currentUser(),vrm=normalize(input.vrm);
  if(!["pro_modder","god_mode"].includes(user.subscription_tier)) throw new Error("Pro Modder access required.");
  const vehicle=(await pool.query("SELECT id,owner_user_id FROM vehicles WHERE vrm=$1",[vrm])).rows[0];
  if(!vehicle || (user.role!=="dev_admin"&&vehicle.owner_user_id!==user.id)) throw new Error("Vehicle ownership required.");
  const id=randomUUID(),data={...input,vrm,id,status:"active"};
  await pool.query("INSERT INTO modifications(id,vehicle_id,data) VALUES($1,$2,$3)",[id,vehicle.id,JSON.stringify(data)]);
  return {ok:true};
}
export async function revertModification(input:{id:string;date:string;mileage:number}) {
  const user=await currentUser();
  if(!["pro_modder","god_mode"].includes(user.subscription_tier)) throw new Error("Pro Modder access required.");
  const result=await pool.query(`UPDATE modifications m SET data=data||$1::jsonb FROM vehicles v
    WHERE m.id=$2 AND m.vehicle_id=v.id AND m.frozen_at IS NULL AND (v.owner_user_id=$3 OR $4) RETURNING m.id`,
    [JSON.stringify({status:"reverted",removalDate:input.date,removalMileage:input.mileage}),input.id,user.id,user.role==="dev_admin"]);
  if(!result.rowCount) throw new Error("Modification not found.");
  return {ok:true};
}
export async function requireAdmin() {
  const user = await currentUser();
  if(user.role!=="dev_admin") throw new Error("SuperAdmin access required.");
  return user;
}
async function transaction<T>(action:(db:PoolClient)=>Promise<T>) {
  const db=await pool.connect();
  try {
    await db.query("BEGIN");
    const result=await action(db);
    await db.query("COMMIT");
    return result;
  } catch(error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {db.release();}
}
export async function adminState():Promise<AdminState> {
  const admin = await requireAdmin();
  const [profiles, records] = await Promise.all([
    pool.query("SELECT id,email,full_name,role,subscription_tier,status,is_sample,garage_name,garage_registration,garage_verified,created_at,workshop_type FROM user_accounts ORDER BY created_at DESC"),
    pool.query("SELECT id,vin,vrm,data,owner_user_id,status,is_sample FROM vehicles ORDER BY vrm"),
  ]);
  const users:AdminUser[] = profiles.rows.map(u=>u.id===admin.id?{...u,role:admin.role,subscription_tier:admin.subscription_tier}:u);
  return {users,vehicles:records.rows.map(r=>({...r.data,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample})),
    applications:users.filter(u=>u.id!==admin.id&&u.status==="pending"&&u.garage_name.trim()&&u.garage_registration.trim())};
}
export async function reviewWorkshop(input:WorkshopReview) {
  const admin=await requireAdmin();
  const approved=input.status==="approved";
  if(approved && !input.vat_verified) throw new Error("Confirm supporting VAT verification before approving the workshop.");
  return transaction(async db=>{
  const result=await db.query(`UPDATE user_accounts SET status=$1,garage_verified=$2,vat_verified=$2,vat_verified_at=CASE WHEN $2 THEN now() ELSE NULL END,
    role=CASE WHEN $2 THEN 'verified_garage' ELSE 'civilian' END,
    subscription_tier=subscription_tier
    WHERE id=$3 AND id<>$4 AND status='pending' AND garage_name<>'' AND garage_registration<>'' AND ($5 OR NOT is_sample) RETURNING id`,
    [input.status,approved,input.id,admin.id,development]);
  if(!result.rowCount) throw new Error("Application is no longer pending or cannot be reviewed here.");
  await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",[randomUUID(),input.id,`Your workshop application was ${input.status} by an administrator.`]);
  return {ok:true};
  });
}
export async function editAdminVehicle(input:AdminVehicleEdit) {
  const admin=await requireAdmin();
  return transaction(async db=>{
  const result=await db.query("UPDATE vehicles SET data=data||$1::jsonb WHERE vrm=$2 RETURNING id",
    [JSON.stringify({make:input.make,model:input.model,odometer:input.odometer}),normalize(input.vrm)]);
  if(!result.rowCount) throw new Error("Vehicle not found.");
  await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",[randomUUID(),admin.id,`Administrator updated vehicle details for ${normalize(input.vrm)}.`]);
  return {ok:true};
  });
}
export async function verifyStamp(id:string) {
  const row=(await pool.query("SELECT s.*,v.vrm FROM service_records s JOIN vehicles v ON v.id=s.vehicle_id WHERE s.id=$1",[id])).rows[0];
  if(!row || !row.is_verified_stamp || !row.stamp_signature) return {valid:false,is_sample:false,garage:"",vrm:"",date:""};
  return {valid:checkStamp(id,row.stamped_by_garage_id,row.data,row.is_sample,row.stamp_signature,signingSecret()),is_sample:row.is_sample as boolean,
    stamp_authority:row.data.stamp_authority==="administrator"?"administrator":"workshop",
    stamp_signature:row.stamp_signature as string,garage:row.data.garage as string,vrm:row.vrm as string,
    date:row.data.date as string,description:row.data.description as string,mileage:row.data.mileage as number};
}

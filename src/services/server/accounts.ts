import { randomUUID, createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";
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

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const development = process.env["NODE_ENV"] !== "production";
const clerk = createClerkClient({secretKey:process.env["CLERK_SECRET_KEY"] ?? ""});
const normalize = (value:string) => value.toUpperCase().replace(/[^A-Z0-9]/g,"");
const digest = (value:string) => createHash("sha256").update(value).digest("hex");
function signingSecret() {
  const secret=process.env["SESSION_SECRET"];
  if (!secret) throw new Error("Workshop signing is not configured.");
  return secret;
}
async function currentUser(): Promise<UserAccount & {dev_role:Role|null; password_hash:string|null}> {
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
   return applyAdminPolicy(profile, primaryEmail);
}
async function seedDevelopmentSamples() {
  if (!development) return;
  for (const [vrm,data] of Object.entries(samples)) {
    await pool.query("INSERT INTO vehicles(id,data,status,is_sample) VALUES($1,$2,'approved',true) ON CONFLICT(id) DO NOTHING",[vrm,JSON.stringify(data)]);
  }
  // Idempotent, explicitly owner-logged historical sample records; old visual badges are not trusted.
  const seed = [
    {id:"sample-service",vrm:"AB14CDE",date:"2024-09-12",mileage:82100,category:"Servicing",description:"Full Service",items:["Engine oil 5W-30 (5L)","Oil filter","Air filter","Pollen filter","Labour"],garage:"Riverside Garage",cost:289,partsCost:154,labourCost:135,fluids:"Castrol Edge 5W-30 LL (VW 504.00/507.00), 4.6L",parts:[{name:"Oil filter",partNo:"Bosch F 026 407 183"},{name:"Air filter",partNo:"Mann C 30 005"},{name:"Pollen filter",partNo:"Febi Bilstein 26600"}],verified:false},
    {id:"sample-brakes",vrm:"AB14CDE",date:"2025-03-08",mileage:85340,category:"Brakes",description:"Brembo Brake Replacement",items:["Brembo front discs (pair)","Brembo front pads","Brake fluid flush (DOT 4)","Labour"],garage:"Apex Performance Ltd",cost:642,partsCost:468,labourCost:174,parts:[{name:"Front discs",partNo:"Brembo 09.C401.13"},{name:"Front pads",partNo:"Brembo P 85 153"}],verified:false},
  ];
  for(const [index,row] of seed.entries()) await pool.query("INSERT INTO service_records(id,vehicle_id,data,is_sample) VALUES($1,$2,$3,true) ON CONFLICT(id) DO NOTHING",[row.id,row.vrm,JSON.stringify({...row,image:index===0?receiptService:receiptBrakes})]);
  const mods=[
    {id:"sample-remap",vrm:"AB14CDE",name:"Stage 2 ECU Remap",category:"Engine/ECU",installDate:"2024-11-02",installMileage:83650,gains:"+53 bhp / +80 Nm",notes:"Development sample modification.",image:dynoSheet,status:"active",stage:"Stage 2",specs:"99 RON map · DPF-safe",tags:["Development sample"]},
    {id:"sample-intake",vrm:"AB14CDE",name:"Ramair Cold Air Intake",category:"Intake",installDate:"2024-10-10",installMileage:83020,gains:"+6 bhp",notes:"Removed due to intermittent MAF sensor fault.",status:"reverted",removalDate:"2024-12-20",removalMileage:84100},
  ];
  for(const mod of mods) await pool.query("INSERT INTO modifications(id,vehicle_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",[mod.id,mod.vrm,JSON.stringify(mod)]);
}
function serviceRow(row:{data:unknown;id:string;is_verified_stamp:boolean;stamped_by_garage_id:string|null;stamp_signature:string|null;is_sample:boolean}):ServiceRecord {
  return {...row.data as ServiceRecord,id:row.id,is_verified_stamp:row.is_verified_stamp,verified:row.is_verified_stamp,
    tier3:row.is_verified_stamp,stamped_by_garage_id:row.stamped_by_garage_id,
    stamp_signature:row.stamp_signature,is_sample:row.is_sample};
}
export async function accountState():Promise<AccountState> {
  const user = await currentUser();
  const { password_hash: _credentials, dev_role: _developmentRole, ...profile } = user;
  await seedDevelopmentSamples();
  const garage = user.role==="verified_garage";
   const records = await pool.query(`SELECT * FROM vehicles v WHERE $4 OR owner_user_id=$1 OR ($2 AND (
    EXISTS(SELECT 1 FROM service_records s WHERE s.vehicle_id=v.id AND s.stamped_by_garage_id=$1) OR
    EXISTS(SELECT 1 FROM workshop_bookings b WHERE b.vehicle_id=v.id AND b.garage_user_id=$1) OR ($3 AND v.is_sample))) ORDER BY v.id`,[user.id,garage,development,user.role==="dev_admin"]);
  const ids = records.rows.map(r=>r.id);
  const [services,mods,notifications,bookings] = await Promise.all([
    pool.query("SELECT * FROM service_records WHERE vehicle_id=ANY($1::text[]) ORDER BY created_at",[ids]),
    pool.query("SELECT data FROM modifications WHERE vehicle_id=ANY($1::text[])",[ids]),
    pool.query("SELECT id,message,read,created_at FROM account_notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",[user.id]),
    pool.query("SELECT id,vehicle_id AS vrm,scheduled_date::text AS date,notes,status FROM workshop_bookings WHERE garage_user_id=$1 OR $2 ORDER BY scheduled_date",[user.id,user.role==="dev_admin"]),
  ]);
  const paid = user.subscription_tier!=="free";
  const history = services.rows.map(serviceRow).map(record=>({...record,has_receipt:Boolean(record.image),has_invoice:Boolean(record.invoice_data)})).map(record=> paid ? record : {...record,
    parts:record.parts?.map(p=>({...p,partNo:"••••••••"})),fluids:record.fluids?"••••••••":undefined,image:undefined,
    invoice_data:undefined,partsCost:undefined,labourCost:undefined});
  return { user:{...profile,garage_verified:user.garage_verified&&(!user.is_sample||development)}, development,
    development_role:user.role==="dev_admin"?(user.dev_role??"superadmin"):development?user.dev_role:null,
    vehicles:records.rows.map(r=>({...r.data,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample})),
    services:history, mods:["pro_modder","god_mode"].includes(user.subscription_tier)?mods.rows.map(r=>r.data):[],
    notifications:notifications.rows,bookings:bookings.rows };
}
export async function claim(input:{vrm:string;reference:string}) {
  const user = await currentUser();
  await seedDevelopmentSamples();
  const vrm = normalize(input.vrm), referenceHash=digest(input.reference);
  let existing = (await pool.query("SELECT * FROM vehicles WHERE id=$1",[vrm])).rows[0];
  if(!existing) {
    const lookup = await lookupRegistration(vrm); // An API failure is never replaced with invented official data.
    await pool.query("INSERT INTO vehicles(id,data,is_sample,status) VALUES($1,$2,$3,'pending') ON CONFLICT(id) DO NOTHING",[vrm,JSON.stringify(lookup.vehicle),lookup.vehicle.source==="demo"]);
    existing = (await pool.query("SELECT * FROM vehicles WHERE id=$1",[vrm])).rows[0];
  }
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const row = (await db.query("SELECT * FROM vehicles WHERE id=$1 FOR UPDATE",[vrm])).rows[0];
    const approved = sampleApproval(development,row.is_sample,row.status);
    if(approved) {
      const used=await db.query("SELECT 1 FROM vehicle_reference_uses WHERE vehicle_id=$1 AND reference_hash=$2",[vrm,referenceHash]);
      const action=referenceAction(Boolean(used.rowCount),row.owner_user_id===user.id,row.v5c_reference_hash===referenceHash);
      if(action==="unchanged") {
        await db.query("COMMIT");
        return {status:"approved" as const,is_sample:true,message:"This development sample is already linked to your account."};
      }
      if(action==="reject") throw new Error("This sample V5C reference has already been used. Enter a NEW 11-digit reference.");
      const consumed=await db.query("INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING vehicle_id",[vrm,referenceHash]);
      if(!consumed.rowCount) throw new Error("This sample V5C reference has already been used. Enter a NEW 11-digit reference.");
    }
    await db.query("INSERT INTO ownership_claims(id,vehicle_id,user_id,reference_hash,status,is_sample) VALUES($1,$2,$3,$4,$5,$6)",[randomUUID(),vrm,user.id,referenceHash,approved?"approved":"pending",row.is_sample]);
    if(approved) {
      if(row.owner_user_id && row.owner_user_id!==user.id) await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",[randomUUID(),row.owner_user_id,`Vehicle ${vrm} has been transferred to a new keeper.`]);
      await db.query("UPDATE vehicles SET owner_user_id=$1,v5c_reference_hash=$2 WHERE id=$3",[user.id,referenceHash,vrm]);
    }
    await db.query("COMMIT");
    return {status:approved?"approved" as const:"pending" as const,is_sample:row.is_sample as boolean,
      message:approved?"Development sample approved instantly. This is not official ownership verification.":"Claim pending review. No ownership has changed."};
  } catch(error) {await db.query("ROLLBACK");throw error;} finally {db.release();}
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
    garage_registration=CASE WHEN garage_registration='' THEN 'SAMPLE-VAT-000' ELSE garage_registration END,
    status='approved',is_sample=true,dev_role=$4 WHERE id=$5`,[accountRole,tier,role==="Garage",role,user.id]);
  return {ok:true};
}
export async function updateAccount(input:{full_name:string;garage_name:string;garage_registration:string;workshop_type?:"garage"|"specialist"|undefined}) {
  const user = await currentUser();
  // Changing workshop identity invalidates live verification; sample approval stays explicit in development.
  await pool.query(`UPDATE user_accounts SET full_name=$1,garage_name=$2,garage_registration=$3,
    garage_verified=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN garage_verified ELSE false END,
    status=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN status ELSE 'pending' END,
    workshop_type=$6 WHERE id=$5`,
    [input.full_name,input.garage_name,input.garage_registration,development,user.id,input.workshop_type??"garage"]);
  return {ok:true};
}
export async function createService(input:Omit<ServiceRecord,"id"|"verified">) {
  const user = await currentUser(), vrm=normalize(input.vrm);
  const row = (await pool.query("SELECT * FROM vehicles WHERE id=$1",[vrm])).rows[0];
  if(!row) throw new Error(`No vehicle passport found for ${vrm}.`);
  const admin=user.role==="dev_admin", workshop=admin||user.role==="verified_garage";
  if(workshop && !admin && !mayStamp({role:user.role,verified:user.garage_verified,status:user.status,garageSample:user.is_sample,vehicleSample:row.is_sample,development})) throw new Error("Workshop verification is pending or this sample account cannot stamp a live vehicle.");
  if(!workshop && row.owner_user_id!==user.id) throw new Error("Only the owner can add a DIY record.");
  if(!workshop && (input.image || input.invoice_data) && user.subscription_tier==="free") throw new Error("Pro DIY is required for receipt uploads.");
  const id=randomUUID(), sample=Boolean(row.is_sample||user.is_sample);
  const data={...input,vrm,id,garage:admin?"V5Vault administrator":workshop?user.garage_name:"Owner logged",
    stamp_authority:admin?"administrator":workshop?"workshop":undefined,
    verified:workshop,tier3:workshop,is_sample:sample,status:"approved"};
  const signature=workshop?signStamp(id,user.id,data,sample,signingSecret()):null;
  const saved = await pool.query(`INSERT INTO service_records(id,vehicle_id,created_by_user_id,data,is_verified_stamp,stamped_by_garage_id,stamp_signature,is_sample)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8 FROM vehicles WHERE id=$2 AND ($5 OR owner_user_id=$3) RETURNING id`,
    [id,vrm,user.id,JSON.stringify(data),workshop,workshop?user.id:null,signature,sample]);
  if(!saved.rowCount) throw new Error("Ownership changed. Reload your account before adding a record.");
  return serviceRow({id,data,is_verified_stamp:workshop,stamped_by_garage_id:workshop?user.id:null,stamp_signature:signature,is_sample:sample});
}
export async function markRead() {
  const user=await currentUser(); await pool.query("UPDATE account_notifications SET read=true WHERE user_id=$1",[user.id]);return {ok:true};
}
async function requireGarage() {
  const user=await currentUser();
  if(user.role!=="dev_admin" && (user.role!=="verified_garage" || !user.garage_verified || user.status!=="approved" || (user.is_sample&&!development))) throw new Error("Verified workshop access required.");
  return user;
}
export async function book(input:{vrm:string;date:string;notes:string}) {
  const user=await requireGarage(),vrm=normalize(input.vrm);
  const vehicle=(await pool.query("SELECT * FROM vehicles WHERE id=$1",[vrm])).rows[0];
  if(!vehicle || (user.role!=="dev_admin"&&user.is_sample&&!vehicle.is_sample)) throw new Error("A sample workshop can only book sample passports.");
  await pool.query("INSERT INTO workshop_bookings(id,garage_user_id,vehicle_id,scheduled_date,notes) VALUES($1,$2,$3,$4,$5)",[randomUUID(),user.id,vrm,input.date,input.notes]);
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
  const vehicle=(await pool.query("SELECT owner_user_id FROM vehicles WHERE id=$1",[vrm])).rows[0];
  if(!vehicle || (user.role!=="dev_admin"&&vehicle.owner_user_id!==user.id)) throw new Error("Vehicle ownership required.");
  const id=randomUUID(),data={...input,vrm,id,status:"active"};
  await pool.query("INSERT INTO modifications(id,vehicle_id,data) VALUES($1,$2,$3)",[id,vrm,JSON.stringify(data)]);
  return {ok:true};
}
export async function revertModification(input:{id:string;date:string;mileage:number}) {
  const user=await currentUser();
  if(!["pro_modder","god_mode"].includes(user.subscription_tier)) throw new Error("Pro Modder access required.");
  const result=await pool.query(`UPDATE modifications m SET data=data||$1::jsonb FROM vehicles v
    WHERE m.id=$2 AND m.vehicle_id=v.id AND (v.owner_user_id=$3 OR $4) RETURNING m.id`,
    [JSON.stringify({status:"reverted",removalDate:input.date,removalMileage:input.mileage}),input.id,user.id,user.role==="dev_admin"]);
  if(!result.rowCount) throw new Error("Modification not found.");
  return {ok:true};
}
async function requireAdmin() {
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
    pool.query("SELECT id,data,owner_user_id,status,is_sample FROM vehicles ORDER BY id"),
  ]);
  const users:AdminUser[] = profiles.rows.map(u=>u.id===admin.id?{...u,role:admin.role,subscription_tier:admin.subscription_tier}:u);
  return {users,vehicles:records.rows.map(r=>({...r.data,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample})),
    applications:users.filter(u=>u.id!==admin.id&&u.status==="pending"&&u.garage_name.trim()&&u.garage_registration.trim())};
}
export async function reviewWorkshop(input:WorkshopReview) {
  const admin=await requireAdmin();
  const approved=input.status==="approved";
  return transaction(async db=>{
  const result=await db.query(`UPDATE user_accounts SET status=$1,garage_verified=$2,
    role=CASE WHEN $2 THEN 'verified_garage' ELSE 'civilian' END,
    subscription_tier=CASE WHEN $2 THEN 'verified_garage' ELSE 'free' END
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
  const result=await db.query("UPDATE vehicles SET data=data||$1::jsonb WHERE id=$2 RETURNING id",
    [JSON.stringify({make:input.make,model:input.model,odometer:input.odometer}),normalize(input.vrm)]);
  if(!result.rowCount) throw new Error("Vehicle not found.");
  await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",[randomUUID(),admin.id,`Administrator updated vehicle details for ${normalize(input.vrm)}.`]);
  return {ok:true};
  });
}
export async function verifyStamp(id:string) {
  const row=(await pool.query("SELECT * FROM service_records WHERE id=$1",[id])).rows[0];
  if(!row || !row.is_verified_stamp || !row.stamp_signature) return {valid:false,is_sample:false,garage:"",vrm:"",date:""};
  return {valid:checkStamp(id,row.stamped_by_garage_id,row.data,row.is_sample,row.stamp_signature,signingSecret()),is_sample:row.is_sample as boolean,
    stamp_authority:row.data.stamp_authority==="administrator"?"administrator":"workshop",
    stamp_signature:row.stamp_signature as string,garage:row.data.garage as string,vrm:row.vehicle_id as string,
    date:row.data.date as string,description:row.data.description as string,mileage:row.data.mileage as number};
}

import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "./db";
import { paidTier } from "./billing";
import { canUseWorkshopFeatures, isWorkshopTrialActive, vehicleLimit } from "@/lib/plans";
import { createClerkClient } from "@clerk/backend";
import { vinMatchesMake } from "@/lib/vin";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { getRequest } from "@tanstack/react-start/server";
import { getPasskeySessionUserId } from "./webauthn";
import { hasClerkSessionCredential } from "./auth-transport";
import type { AccountState, UserAccount, AdminState, AdminUser, AdminVehicleEdit, WorkshopReview } from "@/lib/account-types";
import { applyAdminPolicy } from "./admin-policy";
import { canEditWorkshopProfile, WorkshopProfileAccessError, type AccountProfileInput } from "@/lib/account-profile";
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
export async function currentUser(authRequest?:Request): Promise<UserAccount & {dev_role:Role|null; password_hash:string|null}> {
  const request = authRequest ?? getRequest();
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || new URL(request.url).hostname;
  // TanStack has already consumed POST bodies by the time a serverFn runs.
  // Clerk only needs headers/cookies here; give it a fresh bodyless auth request.
  const clerkRequest = new Request(request.url,{method:"GET",headers:request.headers});
  const passkeyUserId = await getPasskeySessionUserId(request);
  let id: string | undefined = passkeyUserId;
  let primaryEmail: { emailAddress:string; verification:{status:string}|null } | undefined;
  let emailVerified = false;
  if (!id && hasClerkSessionCredential(request)) {
    try {
      const session = await clerk.authenticateRequest(clerkRequest,{publishableKey:publishableKeyFromHost(host,process.env["CLERK_PUBLISHABLE_KEY"])});
      id = session.toAuth()?.userId ?? undefined;
    } catch {
      // A first-party passkey session is checked before Clerk and remains usable if Clerk is unavailable.
    }
  }
  if (!id) throw new Error("Sign in to continue.");
  if (!passkeyUserId) {
    const identity = await clerk.users.getUser(id);
    primaryEmail = identity.emailAddresses.find(e=>e.id===identity.primaryEmailAddressId);
    const email = primaryEmail?.emailAddress;
    if (!email) throw new Error("An email address is required.");
    emailVerified = primaryEmail?.verification?.status==="verified";
    await pool.query(`INSERT INTO user_accounts(id,email,full_name,email_verified) VALUES($1,$2,$3,$4)
      ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,email_verified=EXCLUDED.email_verified`,
    [id,email,[identity.firstName,identity.lastName].filter(Boolean).join(" ") || email.split("@")[0],emailVerified]);
  } else {
    // Native passkey sessions are first-party and must not depend on a Clerk API round-trip.
    const local = (await pool.query("SELECT id FROM user_accounts WHERE id=$1",[id])).rows[0];
    if (!local) throw new Error("Sign in to continue.");
  }
  const profile = (await pool.query("SELECT * FROM user_accounts WHERE id=$1",[id])).rows[0];
  if (!profile) throw new Error("Account could not be loaded.");
  emailVerified = primaryEmail ? primaryEmail.verification?.status==="verified" : profile.email_verified === true;
   const [billing, overrideResult] = await Promise.all([
     paidTier(profile),
     pool.query("SELECT tier_override FROM tier_overrides WHERE user_id=$1",[id]),
   ]);
   const tierOverride = overrideResult.rows[0]?.tier_override === "pro_modder_lifetime" ? "pro_modder_lifetime" : null;
   const approvedTrial = isWorkshopTrialActive(profile)
     && profile.role === "verified_garage"
     && profile.status === "approved"
     && profile.garage_verified
     && profile.vat_verified;
   const workshopAccessActive = billing.tier === "verified_garage" || approvedTrial;
   const tier = tierOverride ? "pro_modder" : approvedTrial ? "verified_garage" : billing.tier;
   return applyAdminPolicy({
     ...profile,
     tier_override:tierOverride,
     subscription_tier:tier,
     workshop_access_active:workshopAccessActive,
     billing_unavailable:billing.unavailable,
      email_verified:emailVerified,
   }, primaryEmail);
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
  for(const mod of mods) await pool.query(`INSERT INTO modifications(id,vehicle_id,data)
    SELECT $1,$2,$3::jsonb || jsonb_build_object('vin',v.vin)
    FROM vehicles v WHERE v.id=$2 ON CONFLICT(id) DO NOTHING`,
    [mod.id,mod.vrm,JSON.stringify(mod)]);
}
export function serviceRow(row:{data:unknown;id:string;vin?:string;physically_inspected_vin?:boolean;is_verified_stamp:boolean;stamped_by_garage_id:string|null;stamp_signature:string|null;is_sample:boolean;frozen_at?:string|null;receipt_url?:string|null;invoice_url?:string|null}):ServiceRecord {
  const verified=Boolean(row.is_verified_stamp && row.stamped_by_garage_id && row.stamp_signature &&
    checkStamp(row.id,row.stamped_by_garage_id,row.data,row.is_sample,row.stamp_signature,signingSecret()));
  const record=row.data as ServiceRecord;
  return {...record,id:row.id,image:row.receipt_url??record.image,receipt_url:row.receipt_url??record.receipt_url,
    invoice_data:row.invoice_url??record.invoice_data,vin:row.vin??record.vin,
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
    return {...record,has_receipt:Boolean(record.image || record.receipt_url),has_invoice:Boolean(record.invoice_data),
      image:receiptAllowed?record.image:undefined,receipt_url:receiptAllowed?record.receipt_url:undefined,
      invoice_data:receiptAllowed?record.invoice_data:undefined};
  }).map(record=> paid ? record : {...record,
    parts:record.parts?.map(p=>({...p,partNo:"••••••••"})),fluids:record.fluids?"••••••••":undefined,image:undefined,
    receipt_url:undefined,invoice_data:undefined,partsCost:undefined,labourCost:undefined});
  const activeIds=new Set(records.rows.filter(r=>r.owner_user_id===user.id).map(r=>String(r.id)).sort().slice(0,vehicleLimit(user)));
  return { user:{...profile,garage_verified:user.garage_verified&&(!user.is_sample||development)}, development,
    development_role:user.role==="dev_admin"?(user.dev_role??"superadmin"):development?user.dev_role:null,
    vehicles:records.rows.map(r=>({...((r.archive_snapshot&&r.owner_user_id!==user.id&&user.role!=="dev_admin")?r.archive_snapshot.vehicle:r.data),
      vrm:r.vrm,vin:r.vin,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample,public_enabled:r.public_enabled,
       keeper_changed_at:r.keeper_changed_at,verification_tier:r.verification_tier??"provisional",
       verification_state:r.verification_state??"PENDING_VERIFICATION",is_scrapped:Boolean(r.is_scrapped),
       access:r.archive_snapshot&&r.owner_user_id!==user.id&&user.role!=="dev_admin"?"archived":r.owner_user_id===user.id&&!activeIds.has(r.id)?"plan_locked":"active"})),
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
export async function updateAccount(input:AccountProfileInput, authRequest?:Request) {
  const user = await currentUser(authRequest);
  const hasWorkshopDetails = input.garage_name !== undefined
    || input.garage_registration !== undefined
    || input.workshop_type !== undefined;
  if (!hasWorkshopDetails) {
    await pool.query("UPDATE user_accounts SET full_name=$1,display_preference=COALESCE($2,display_preference) WHERE id=$3", [input.full_name,input.display_preference ?? null,user.id]);
    return {ok:true};
  }
  if (!canEditWorkshopProfile(user)) throw new WorkshopProfileAccessError();
  const garageName = input.garage_name ?? user.garage_name;
  const garageRegistration = input.garage_registration ?? user.garage_registration;
  const workshopType = input.workshop_type ?? user.workshop_type ?? "garage";
  const startsWorkshopTrial = !user.trial_expires_at
    && !user.garage_registration.trim()
    && Boolean(garageName.trim() && garageRegistration.trim())
    && user.subscription_tier !== "verified_garage";
  // Changing workshop identity invalidates live verification; sample approval stays explicit in development.
  await pool.query(`UPDATE user_accounts SET full_name=$1,garage_name=$2,garage_registration=$3,
    garage_verified=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN garage_verified ELSE false END,
    vat_verified=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN vat_verified ELSE false END,
    status=CASE WHEN (garage_name=$2 AND garage_registration=$3 AND workshop_type=$6) OR (is_sample AND $4) THEN status ELSE 'pending' END,
    subscription_status=CASE WHEN $7 AND trial_expires_at IS NULL THEN 'trialing' ELSE subscription_status END,
    trial_expires_at=CASE WHEN $7 AND trial_expires_at IS NULL THEN now()+interval '30 days' ELSE trial_expires_at END,
     workshop_type=$6,display_preference=COALESCE($8,display_preference) WHERE id=$5`,
    [input.full_name,garageName,garageRegistration,development,user.id,workshopType,startsWorkshopTrial,input.display_preference ?? null]);
  return {ok:true};
}
export async function createService(input:Omit<ServiceRecord,"id"|"verified">) {
  const user = await currentUser(), vrm=normalize(input.vrm);
  const receipt = decodeAttachment(input.image,"receipt","receipt.jpg");
  const invoice = decodeAttachment(input.invoice_data,"invoice",input.invoice_name??"invoice.pdf");
  return transaction(async db=>{
  const row = (await db.query("SELECT * FROM vehicles WHERE vrm=$1 FOR UPDATE",[vrm])).rows[0];
  if(!row) throw new Error(`No vehicle passport found for ${vrm}.`);
  if(row.is_scrapped) throw new Error("This vehicle is marked as scrapped. Its passport is read-only and new service records are blocked.");
   const admin=user.role==="dev_admin", workshop=admin||canUseWorkshopFeatures(user);
   if(workshop && row.verification_state!=="VERIFIED" && !(development && row.is_sample)) throw new Error("Logbook or Plate Updated: Please enter your new VRM and 11-digit V5C reference number to re-verify ownership and unlock live export features.");
   if(workshop && !admin && !mayStamp({role:user.role,verified:user.garage_verified,status:user.status,garageSample:user.is_sample,vehicleSample:row.is_sample,development})) throw new Error("An approved VAT-verified workshop with an active Workshop subscription or trial is required to sign records.");
  if(!workshop && row.owner_user_id!==user.id) throw new Error("Only the owner can add a DIY record.");
  if(workshop && input.physically_inspected_vin !== true) throw new Error("A workshop must physically inspect and match the VIN before stamping.");
  if(input.vin && input.vin.toUpperCase() !== row.vin) throw new Error("The service record VIN does not match this vehicle passport.");
  if(input.vin && !vinMatchesMake(input.vin,row.data?.make ?? "")) throw new Error("The VIN manufacturer prefix does not match this vehicle make.");
  if(!workshop && user.role!=="dev_admin") {
    const owned=await pool.query("SELECT id FROM vehicles WHERE owner_user_id=$1 ORDER BY id",[user.id]);
    if(owned.rows.findIndex(v=>v.id===row.id)>=vehicleLimit(user)) throw new Error("This vehicle is outside your active plan limit. Upgrade to Collector for three vehicles.");
  }
  const id=input.client_submission_id??randomUUID();
  if(input.client_submission_id) {
    const existing=(await db.query("SELECT * FROM service_records WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(existing) {
      if(existing.created_by_user_id!==user.id || existing.vehicle_id!==row.id || existing.vin!==row.vin) {
        throw new Error("This offline submission ID is already attached to another account or vehicle.");
      }
      return serviceRow(existing);
    }
  }
  const sample=Boolean(row.is_sample||user.is_sample), receiptUrl=receipt?`/api/services/${id}/receipt`:undefined,
    invoiceUrl=invoice?`/api/services/${id}/invoice`:undefined;
  const data={...input,vrm,vin:row.vin,physically_inspected_vin:Boolean(input.physically_inspected_vin),id,
    components:input.components??input.items,work_performed:input.work_performed??input.description,
    advisories:input.advisories??[],currency:"GBP" as const,image:receiptUrl,receipt_url:receiptUrl,
    invoice_data:invoiceUrl,invoice_url:invoiceUrl,invoice_name:invoice?.filename??input.invoice_name,
    receipt_sha256:receipt?.sha256,invoice_sha256:invoice?.sha256,has_receipt:Boolean(receipt),garage:admin?"V5Vault administrator":workshop?user.garage_name:"Owner logged",
    stamp_authority:admin?"administrator":workshop?"workshop":undefined,vat_verified:!admin&&workshop&&Boolean(user.vat_verified),
    verified:workshop,tier3:workshop,is_sample:sample,status:"approved"};
  const signature=workshop?signStamp(id,user.id,data,sample,signingSecret()):null;
  const saved = await db.query(`INSERT INTO service_records(
    id,vehicle_id,vin,physically_inspected_vin,created_by_user_id,data,is_verified_stamp,stamped_by_garage_id,
    stamp_signature,is_sample,stamped_by_user_id,stamped_at,service_type,mileage,components,work_performed,
    advisories,parts,parts_cost,labour_cost,currency,receipt_url,invoice_url)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $7 THEN now() ELSE NULL END,
      $12,$13,$14::jsonb,$15,$16,$17::jsonb,$18,$19,$20,$21,$22
    FROM vehicles WHERE id=$2 AND vin=$3 AND is_scrapped=false AND ($7 OR owner_user_id=$5) RETURNING id`,
    [id,row.id,row.vin,data.physically_inspected_vin,user.id,JSON.stringify(data),workshop,workshop?user.id:null,signature,sample,
      workshop?user.id:null,input.category,input.mileage,JSON.stringify(data.components),data.work_performed,data.advisories,
      JSON.stringify(input.parts??[]),input.partsCost??null,input.labourCost??null,"GBP",receiptUrl??null,invoiceUrl??null]);
  if(!saved.rowCount) throw new Error("Ownership changed. Reload your account before adding a record.");
  if(receipt) await db.query(`INSERT INTO service_attachments(service_record_id,attachment_type,content_type,filename,sha256,content)
    VALUES($1,'receipt',$2,$3,$4,$5)`,[id,receipt.contentType,receipt.filename,receipt.sha256,receipt.content]);
  if(invoice) await db.query(`INSERT INTO service_attachments(service_record_id,attachment_type,content_type,filename,sha256,content)
    VALUES($1,'invoice',$2,$3,$4,$5)`,[id,invoice.contentType,invoice.filename,invoice.sha256,invoice.content]);
  if(workshop) await db.query(`UPDATE vehicles SET verification_tier=CASE WHEN verification_tier='government_data'
    THEN verification_tier ELSE 'workshop_checked' END WHERE vin=$1 AND is_scrapped=false`,[row.vin]);
  return serviceRow({id,data,receipt_url:receiptUrl??null,invoice_url:invoiceUrl??null,is_verified_stamp:workshop,stamped_by_garage_id:workshop?user.id:null,stamp_signature:signature,is_sample:sample});
  });
}

function decodeAttachment(dataUri:string|undefined,type:"receipt"|"invoice",filename:string) {
  if(!dataUri) return undefined;
  const match=/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUri);
  if(!match || (type==="receipt"&&!match[1]!.startsWith("image/")) || (type==="invoice"&&match[1]!=="application/pdf")) {
    throw new Error(type==="receipt"?"Receipt photos must be JPEG, PNG or WebP images.":"Workshop invoices must be PDF files.");
  }
  const content=Buffer.from(match[2]!.replace(/\s/g,""),"base64");
  const maxBytes=type==="receipt"?3*1024*1024:5*1024*1024;
  if(!content.length||content.length>maxBytes) throw new Error(type==="receipt"?"Receipt photos must be 3 MB or smaller after resizing.":"Invoice PDFs must be 5 MB or smaller.");
  const sha256=createHash("sha256").update(content).digest("hex");
  return {contentType:match[1]!,content,sha256,filename:filename.replace(/[^A-Za-z0-9._ -]/g,"_").slice(0,150)||`${type}.pdf`};
}

export async function serviceAttachment(id:string,type:"receipt"|"invoice") {
  const user=await currentUser();
  const row=(await pool.query(`SELECT s.receipt_url,s.invoice_url,s.frozen_at,s.created_by_user_id,s.stamped_by_garage_id,
    s.data,s.vehicle_id,v.owner_user_id,a.content_type,a.filename,a.sha256,a.content
    FROM service_records s JOIN vehicles v ON v.id=s.vehicle_id
    LEFT JOIN service_attachments a ON a.service_record_id=s.id AND a.attachment_type=$2 WHERE s.id=$1`,
    [id,type])).rows[0];
  const url=type==="receipt"?row?.receipt_url:row?.invoice_url;
  if(!url||!row.content) throw new Error("Attachment not found.");
  const createdBy= row.created_by_user_id===user.id || row.stamped_by_garage_id===user.id;
  const currentKeeper=row.owner_user_id===user.id && !row.frozen_at;
  const admin=user.role==="dev_admin";
  let archiveKeeper=false;
  if(row.frozen_at) {
    const transfer=await pool.query(`SELECT 1 FROM vehicle_transfers WHERE vehicle_id=$1
      AND previous_keeper_id=$2 AND transferred_at >= (SELECT created_at FROM service_records WHERE id=$3) LIMIT 1`,
      [row.vehicle_id,user.id,id]);
    archiveKeeper=Boolean(transfer.rowCount);
  }
  if(!createdBy&&!currentKeeper&&!archiveKeeper&&!admin) throw new Error("Receipt access is limited to the vehicle keeper and the record creator.");
  const expected=(row.data as Record<string,unknown>)[`${type}_sha256`];
  const actual=createHash("sha256").update(row.content).digest("hex");
  if(typeof expected!=="string"||expected!==row.sha256||actual!==row.sha256) throw new Error("The receipt failed its integrity check.");
  return { content:row.content as Buffer, contentType:row.content_type as string, filename:row.filename as string };
}
export async function markRead() {
  const user=await currentUser(); await pool.query("UPDATE account_notifications SET read=true WHERE user_id=$1",[user.id]);return {ok:true};
}
export async function requireGarage() {
  const user=await currentUser();
  if(user.role!=="dev_admin" && (!canUseWorkshopFeatures(user) || (user.is_sample&&!development))) throw new Error("A VAT-verified Workshop account with an active subscription or trial is required.");
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
  const vehicle=(await pool.query("SELECT id,vin,owner_user_id,is_scrapped FROM vehicles WHERE vrm=$1",[vrm])).rows[0];
  if(vehicle?.is_scrapped) throw new Error("This vehicle is marked as scrapped. Its passport is read-only.");
  if(!vehicle || (user.role!=="dev_admin"&&vehicle.owner_user_id!==user.id)) throw new Error("Vehicle ownership required.");
  const id=randomUUID(),data={...input,vrm,vin:vehicle.vin,id,status:"active"};
  await pool.query("INSERT INTO modifications(id,vehicle_id,data) VALUES($1,$2,$3)",
    [id,vehicle.id,JSON.stringify(data)]);
  return {ok:true};
}
export async function revertModification(input:{id:string;date:string;mileage:number}) {
  const user=await currentUser();
  if(!["pro_modder","god_mode"].includes(user.subscription_tier)) throw new Error("Pro Modder access required.");
  const result=await pool.query(`UPDATE modifications m SET data=data||$1::jsonb FROM vehicles v
    WHERE m.id=$2 AND m.vehicle_id=v.id AND m.frozen_at IS NULL AND v.is_scrapped=false
    AND (v.owner_user_id=$3 OR $4) RETURNING m.id`,
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
    pool.query(`SELECT u.id,u.email,u.full_name,u.role,u.subscription_tier,u.status,u.is_sample,
      u.garage_name,u.garage_registration,u.garage_verified,u.vat_verified,u.created_at,u.workshop_type,
      u.subscription_status,u.trial_expires_at,o.tier_override
      FROM user_accounts u LEFT JOIN tier_overrides o ON o.user_id=u.id
      WHERE u.email IS NOT NULL ORDER BY u.created_at DESC`),
    pool.query("SELECT id,vin,vrm,data,owner_user_id,status,is_sample,verification_tier,is_scrapped FROM vehicles ORDER BY vrm"),
  ]);
  const users:AdminUser[] = profiles.rows.map(u=>u.id===admin.id?{...u,role:admin.role,subscription_tier:admin.subscription_tier}:u);
  return {users,vehicles:records.rows.map(r=>({...r.data,owner_user_id:r.owner_user_id,status:r.status,is_sample:r.is_sample,
    verification_tier:r.verification_tier??"provisional",is_scrapped:Boolean(r.is_scrapped)})),
    applications:users.filter(u=>u.id!==admin.id&&u.status==="pending"&&u.garage_name.trim()&&u.garage_registration.trim())};
}
export async function grantTierOverride(id:string) {
  const admin=await requireAdmin();
  return transaction(async db=>{
    const target=(await db.query("SELECT id FROM user_accounts WHERE id=$1 FOR UPDATE",[id])).rows[0];
    if(!target) throw new Error("Account not found.");
    await db.query(`INSERT INTO tier_overrides(user_id,tier_override,granted_by)
      VALUES($1,'pro_modder_lifetime',$2)
      ON CONFLICT(user_id) DO UPDATE SET tier_override='pro_modder_lifetime',granted_by=EXCLUDED.granted_by,granted_at=now()`,
      [id,admin.id]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",
      [randomUUID(),id,"A V5Vault administrator granted lifetime Pro Modder access."]);
    return {ok:true};
  });
}
export async function revokeTierOverride(id:string) {
  const admin=await requireAdmin();
  return transaction(async db=>{
    const result=await db.query("DELETE FROM tier_overrides WHERE user_id=$1 RETURNING user_id",[id]);
    if(!result.rowCount) throw new Error("This account has no active lifetime Pro Modder override.");
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",
      [randomUUID(),id,"A V5Vault administrator revoked lifetime Pro Modder access. Any separate active paid subscription remains unchanged."]);
    return {ok:true};
  });
}
export async function extendWorkshopTrial(id:string) {
  const admin=await requireAdmin();
  return transaction(async db=>{
    const result=await db.query(`UPDATE user_accounts SET subscription_status='trialing',
      trial_expires_at=GREATEST(COALESCE(trial_expires_at,now()),now())+interval '30 days'
      WHERE id=$1 AND id<>$2 AND role='verified_garage' AND status='approved'
        AND garage_verified=true AND vat_verified=true AND ($3 OR NOT is_sample)
      RETURNING trial_expires_at`,
      [id,admin.id,development]);
    if(!result.rowCount) throw new Error("Only an approved, VAT-verified workshop can receive a trial extension.");
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",
      [randomUUID(),id,"A V5Vault administrator extended your Workshop trial by 30 days."]);
    return {ok:true,trial_expires_at:result.rows[0].trial_expires_at};
  });
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
  const details={make:input.make,model:input.model,odometer:input.odometer,
    ...(input.is_scrapped===undefined?{}:{is_scrapped:input.is_scrapped})};
  const result=await db.query(`UPDATE vehicles SET data=data||$1::jsonb,
    is_scrapped=CASE WHEN $3::boolean IS NULL THEN is_scrapped ELSE $3 END,
    scrapped_at=CASE WHEN $3::boolean IS NULL THEN scrapped_at WHEN $3 THEN COALESCE(scrapped_at,now()) ELSE NULL END
    WHERE vrm=$2 RETURNING id`,
    [JSON.stringify(details),normalize(input.vrm),input.is_scrapped??null]);
  if(!result.rowCount) throw new Error("Vehicle not found.");
  await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",[randomUUID(),admin.id,
    `Administrator updated vehicle details${input.is_scrapped===undefined?"":` and scrap status for ${normalize(input.vrm)}`}.`]);
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

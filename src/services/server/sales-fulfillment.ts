import type Stripe from "stripe";
import { pool } from "./db";
import { PLAN_DEFINITIONS } from "@/lib/plans";
/** Only a verified Stripe event/API response may be passed here, never URL parameters. */
export async function fulfillSalesPack(session: Stripe.Checkout.Session) {
  if(session.mode!=="payment"||session.status!=="complete"||session.payment_status!=="paid"
    ||session.currency!=="gbp"||session.amount_total!==PLAN_DEFINITIONS.sales_pack.amount
    ||session.metadata?.["app"]!=="v5vault"||session.metadata?.["plan_key"]!=="sales_pack"
    ||session.client_reference_id!==session.metadata?.["user_id"])return false;
  const result=await pool.query(`UPDATE sales_pack_orders SET fulfilled_at=COALESCE(fulfilled_at,now())
    WHERE id=$1 AND user_id=$2 AND stripe_checkout_session_id=$3 RETURNING id`,
    [session.metadata?.["order_id"],session.client_reference_id,session.id]);
  return Boolean(result.rowCount);
}

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CircleHelp, LoaderCircle, ShieldAlert } from "lucide-react";
import { useV1 } from "@/lib/use-v1";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => ({ session_id: typeof search["session_id"] === "string" ? search["session_id"] : "" }),
  component: CheckoutSuccess,
});

function CheckoutSuccess() {
  const { session_id } = Route.useSearch();
  const v1 = useV1();
  const confirm = useRef(v1.confirmCheckout);
  confirm.current = v1.confirmCheckout;
  const [state, setState] = useState<{ kind: "checking" | "paid" | "pending" | "invalid" | "error"; detail: string }>({
    kind: "checking", detail: "Checking the payment session with V5Vault…",
  });
  const attempt = useRef("");
  useEffect(() => {
    if (!session_id || !/^cs_[A-Za-z0-9_]{1,145}$/.test(session_id)) {
      setState({ kind: "invalid", detail: "A valid checkout session reference was not provided." });
      return;
    }
    if (attempt.current === session_id) return;
    attempt.current = session_id;
    let active = true;
    void confirm.current(session_id).then((result) => {
      if (!active) return;
      setState(result.fulfilled
        ? { kind: "paid", detail: result.message || "Payment confirmed by the server. Your account is ready." }
        : { kind: "pending", detail: result.message || "The server has not confirmed a completed payment yet. No entitlement has been granted." });
    }).catch((error: unknown) => {
      if (active) setState({ kind: "error", detail: error instanceof Error ? error.message : "Payment status could not be confirmed." });
    });
    return () => { active = false; };
  }, [session_id]);
  const icon = state.kind === "paid" ? <BadgeCheck className="h-8 w-8 text-success"/> : state.kind === "checking" ? <LoaderCircle className="h-8 w-8 animate-spin text-primary"/> : state.kind === "invalid" || state.kind === "error" ? <ShieldAlert className="h-8 w-8 text-warning"/> : <CircleHelp className="h-8 w-8 text-warning"/>;
  return <main className="mx-auto flex min-h-[100dvh] max-w-xl items-center px-4 pb-28 pt-6">
    <section className="vault-card w-full p-6 sm:p-8">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">V5Vault / checkout</p>
      <h1 className="mt-2 text-2xl font-extrabold">{state.kind === "paid" ? "Payment confirmed" : state.kind === "checking" ? "Confirming your payment" : state.kind === "pending" ? "Payment is still pending" : "Payment not confirmed"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.detail}</p>
      {state.kind === "paid" && <p className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">The confirmation came from the payment server. Plan access is not inferred from this return URL.</p>}
      {(state.kind === "pending" || state.kind === "error") && <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">Do not repeat payment solely because this screen is pending. Check your billing account or contact support if the status does not update.</p>}
      <Link to="/passport" className="btn-primary mt-6 min-h-12 w-full">Return to passport</Link>
    </section>
  </main>;
}

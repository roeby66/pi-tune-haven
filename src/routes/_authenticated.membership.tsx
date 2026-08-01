import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Crown, Loader2, Sparkles, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listMembershipPlans,
  getMyMembership,
  approveMembershipPayment,
  completeMembershipPayment,
  cancelMembershipPayment,
  type MembershipPlan,
} from "@/lib/payments.functions";
import { createPiPayment } from "@/lib/pi-payments";
import { isPiBrowser } from "@/lib/pi-auth";

export const Route = createFileRoute("/_authenticated/membership")({
  head: () => ({
    meta: [
      { title: "Membership — MyPiMusic" },
      { name: "description", content: "Subscribe with Pi to unlock premium features on MyPiMusic." },
    ],
  }),
  component: MembershipPage,
});

type FlowState =
  | { kind: "idle" }
  | { kind: "confirm"; plan: MembershipPlan }
  | { kind: "processing"; plan: MembershipPlan; step: string }
  | { kind: "success"; plan: MembershipPlan }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string }
  | { kind: "network_error" };

function MembershipPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const plans = useQuery({ queryKey: ["membership", "plans"], queryFn: () => listMembershipPlans() });
  const mine = useQuery({ queryKey: ["membership", "mine"], queryFn: () => getMyMembership() });
  const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

  const approve = useMutation({
    mutationFn: (v: { paymentId: string; planId: string }) => approveMembershipPayment({ data: v }),
  });
  const complete = useMutation({
    mutationFn: (v: { paymentId: string; txid: string }) => completeMembershipPayment({ data: v }),
  });
  const cancel = useMutation({
    mutationFn: (v: { paymentId: string }) => cancelMembershipPayment({ data: v }),
  });

  async function startPayment(plan: MembershipPlan) {
    alert(
  JSON.stringify({
    isPiBrowser: isPiBrowser(),
    hasPi: !!window.Pi,
    hasCreatePayment: !!window.Pi?.createPayment,
  })
);
    setFlow({ kind: "processing", plan, step: "Opening Pi Wallet…" });
    try {

      await createPiPayment(
        {
          amount: Number(plan.price),
          memo: `MyPiMusic ${plan.display_name} (${plan.billing_cycle})`,
          metadata: { type: "membership", plan_id: plan.id, plan_name: plan.name },
        },
        {
          onReadyForServerApproval: async (paymentId) => {
            setFlow({ kind: "processing", plan, step: "Approving on server…" });
            try {
              await approve.mutateAsync({ paymentId, planId: plan.id });
            } catch (e) {
              setFlow({ kind: "failed", message: (e as Error).message });
            }
          },
          onReadyForServerCompletion: async (paymentId, txid) => {
            setFlow({ kind: "processing", plan, step: "Verifying payment on Pi Platform…" });
            try {
              await complete.mutateAsync({ paymentId, txid });
              qc.invalidateQueries({ queryKey: ["membership"] });
              setFlow({ kind: "success", plan });
            } catch (e) {
              setFlow({ kind: "failed", message: (e as Error).message });
            }
          },
          onCancel: async (paymentId) => {
            try {
              await cancel.mutateAsync({ paymentId });
            } catch {
              /* noop */
            }
            setFlow({ kind: "cancelled" });
          },
          onError: (error) => {
            const msg = error?.message || "";
            if (/network|fetch|offline/i.test(msg)) {
              setFlow({ kind: "network_error" });
            } else {
              setFlow({ kind: "failed", message: msg || "Unknown error" });
            }
          },
        },
      );
    } catch (e) {
      const msg = (e as Error).message || "";
      if (msg === "PI_PAYMENTS_UNAVAILABLE") {
        setFlow({ kind: "failed", message: "Pi Payments SDK is not available. Open inside Pi Browser." });
      } else if (/network|fetch/i.test(msg)) {
        setFlow({ kind: "network_error" });
      } else {
        setFlow({ kind: "failed", message: msg || "Failed to start payment" });
      }
    }
  }

  const currentPlanName = mine.data?.plan_name;
  const list = plans.data ?? [];

  return (
    <div className="space-y-6">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Choose your <span className="text-primary">MyPiMusic</span> Membership
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay with Test-Pi via the official Pi Wallet. Cancel any time.
        </p>
        {mine.data && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-3 w-3" /> Active: {mine.data.membership_level}
            {mine.data.expires_at && (
              <span className="opacity-70">
                · renews {new Date(mine.data.expires_at).toLocaleDateString()}
              </span>
            )}
          </p>
        )}
      </header>

      {plans.isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((plan) => {
            const isPremium = plan.name.startsWith("premium");
            const isCurrent = currentPlanName === plan.name;
            return (
              <article
                key={plan.id}
                className={[
                  "relative rounded-2xl border p-5 transition-all",
                  isPremium
                    ? "border-primary/60 bg-gradient-to-b from-primary/15 via-card to-card shadow-purple"
                    : "border-white/10 bg-card/70",
                ].join(" ")}
              >
                {isPremium && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {isPremium ? (
                    <Crown className="h-5 w-5 text-primary" />
                  ) : (
                    <Sparkles className="h-5 w-5 text-primary/80" />
                  )}
                  <h2 className="text-lg font-bold">{plan.display_name}</h2>
                  {isCurrent && (
                    <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      Current
                    </span>
                  )}
                </div>
                {plan.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                )}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-gradient-gold">
                    {Number(plan.price).toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Test-Pi / {plan.billing_cycle}
                  </span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {plan.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full font-bold"
                  variant={isPremium ? "default" : "secondary"}
                  disabled={isCurrent}
                  onClick={() => setFlow({ kind: "confirm", plan })}
                >
                  {isCurrent ? "Currently active" : `Subscribe with Pi`}
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Payments are processed on the Pi Testnet. MyPiMusic is an independent third-party app and is not
        affiliated with Pi Network or the Pi Core Team.
      </p>

      {/* Confirm dialog */}
      <Dialog
        open={flow.kind === "confirm"}
        onOpenChange={(o) => !o && setFlow({ kind: "idle" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Membership</DialogTitle>
            <DialogDescription>Review your subscription details below.</DialogDescription>
          </DialogHeader>
          {flow.kind === "confirm" && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-card/70 p-4 text-sm">
              <Row label="Membership plan" value={flow.plan.display_name} />
              <Row label="Billing cycle" value={flow.plan.billing_cycle} />
              <Row
                label="Price"
                value={`${Number(flow.plan.price).toFixed(2)} Test-Pi`}
                highlight
              />
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setFlow({ kind: "idle" })}>
              Cancel
            </Button>
            <Button
              onClick={() => flow.kind === "confirm" && startPayment(flow.plan)}
              className="font-bold"
            >
              Continue Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Processing dialog */}
      <Dialog open={flow.kind === "processing"}>
        <DialogContent
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Processing your Pi payment…</DialogTitle>
            <DialogDescription>Please wait — do not close this window.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            {flow.kind === "processing" && <p>{flow.step}</p>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={flow.kind === "success"} onOpenChange={(o) => !o && setFlow({ kind: "idle" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" /> Payment Successful
            </DialogTitle>
            <DialogDescription>
              Your membership has been activated successfully.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => navigate({ to: "/home" })}>
              Go Home
            </Button>
            <Button onClick={() => setFlow({ kind: "idle" })}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelled */}
      <Dialog open={flow.kind === "cancelled"} onOpenChange={(o) => !o && setFlow({ kind: "idle" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" /> Payment Cancelled
            </DialogTitle>
            <DialogDescription>
              No payment has been made. Membership remains inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setFlow({ kind: "idle" })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failed */}
      <Dialog
        open={flow.kind === "failed"}
        onOpenChange={(o) => !o && setFlow({ kind: "idle" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Payment Failed
            </DialogTitle>
            <DialogDescription>
              {flow.kind === "failed" ? flow.message : "Something went wrong."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setFlow({ kind: "idle" })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Network error */}
      <Dialog
        open={flow.kind === "network_error"}
        onOpenChange={(o) => !o && setFlow({ kind: "idle" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Network Error
            </DialogTitle>
            <DialogDescription>
              Could not reach the Pi network. Please check your connection and try again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setFlow({ kind: "idle" })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={highlight ? "font-bold text-gradient-gold" : "font-semibold"}>{value}</span>
    </div>
  );
}


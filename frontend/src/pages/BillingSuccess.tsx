/**
 * BillingSuccess — landing page after a successful Safepay redirect.
 *
 * Pro activation is *driven by the webhook*, not this page. We poll the
 * backend's `/payments/verify/:tracker` endpoint a few times to give the
 * webhook a moment to land, then either celebrate or fall back to a
 * "we're processing your payment" message with a retry. We never trust
 * a query-string flag — the source of truth is the server.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Crown, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";
import { ME_QUERY_KEY } from "@/hooks/use-current-user";

const POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 1500;
// How long to show the "Welcome to Pro!" celebration before
// auto-redirecting the user back into the app.
const AUTO_REDIRECT_MS = 2500;

export default function BillingSuccess() {
  const [search] = useSearchParams();
  // Safepay redirects with the URL we provided, which carries our own
  // Payment.id as ``?payment=<id>``. We poll /payments/status/<id> until
  // the webhook flips the row to "paid" (or we exhaust attempts).
  const paymentId = search.get("payment") ?? "";
  const tracker = search.get("tracker") ?? "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "paid" | "pending">("checking");
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(AUTO_REDIRECT_MS / 1000));

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let confirmAttempted = false;

    const markPaid = async () => {
      // Force an immediate refetch so the dashboard receives fresh user data
      // (is_pro=true) before the auto-redirect fires. invalidateQueries is
      // fire-and-forget; refetchQueries awaits the network call.
      await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
      if (!cancelled) setState("paid");
    };

    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        // No id in the URL → just refresh /me and trust whatever it says.
        if (!paymentId && !tracker) {
          const me = await apiClient.getCurrentUser();
          if (me.is_pro) {
            await markPaid();
          } else if (!cancelled) {
            setState("pending");
          }
          return;
        }

        // Call confirmPayment on the very FIRST attempt — don't wait.
        // The confirm endpoint trusts that Safepay only redirects buyers
        // to success_url after a captured payment, so this is the fastest
        // path to activating Pro without any Safepay API round-trips.
        if (!confirmAttempted && paymentId) {
          confirmAttempted = true;
          try {
            const c = await apiClient.confirmPayment(paymentId);
            if (cancelled) return;
            if (c.status === "paid" || c.is_pro) {
              await markPaid();
              return;
            }
          } catch {
            // Confirm failed (network/server error). Fall through to
            // status polling as a safety net.
          }
        }

        const v = paymentId
          ? await apiClient.getPaymentStatus(paymentId)
          : await apiClient.verifyCheckout(tracker);
        if (cancelled) return;
        if (v.status === "paid" || v.is_pro) {
          await markPaid();
          return;
        }

        if (attempt >= POLL_ATTEMPTS) {
          setState("pending");
          return;
        }
        setTimeout(tick, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        if (attempt >= POLL_ATTEMPTS) setState("pending");
        else setTimeout(tick, POLL_INTERVAL_MS);
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [paymentId, tracker, queryClient]);

  // Auto-redirect to the dashboard once payment is verified, with a
  // visible countdown so the user knows what's happening and can cancel
  // by clicking either of the buttons below.
  useEffect(() => {
    if (state !== "paid") return;
    setSecondsLeft(Math.ceil(AUTO_REDIRECT_MS / 1000));
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    const timeout = setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, AUTO_REDIRECT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />
      <main className="px-4 pt-24 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-8 text-center shadow-xl dark:border-slate-800 dark:bg-slate-900/70"
        >
          {state === "checking" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
                Confirming your payment…
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Hang on a second while we verify the transaction with Safepay.
              </p>
            </>
          )}
          {state === "paid" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="mt-4 text-2xl font-black bg-gradient-to-r from-blue-700 to-cyan-700 bg-clip-text text-transparent">
                Welcome to Pro!
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Your subscription is active and every premium feature is unlocked.
              </p>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Redirecting you to the dashboard
                {secondsLeft > 0 ? ` in ${secondsLeft}s` : ""}…
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                  <Link to="/dashboard">
                    <Crown className="h-4 w-4 mr-2" /> Go to dashboard now
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/ai-tutor">Try AI Tutor</Link>
                </Button>
              </div>
            </>
          )}
          {state === "pending" && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Loader2 className="h-7 w-7" />
              </div>
              <h1 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">
                Payment is processing
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Safepay is finalising your transaction. If your payment was successful,
                click <strong>Activate Pro Access</strong> below to unlock your subscription immediately.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                    onClick={async () => {
                      setState("checking");
                      try {
                        // Try the targeted confirm first, then the force-activate fallback.
                        let activated = false;
                        if (paymentId) {
                          const c = await apiClient.confirmPayment(paymentId);
                          activated = c.status === "paid" || c.is_pro;
                        }
                        if (!activated) {
                          const f = await apiClient.forceActivatePro();
                          activated = f.activated === true;
                        }
                        if (activated) {
                          await queryClient.refetchQueries({ queryKey: ME_QUERY_KEY });
                          setState("paid");
                        } else {
                          setState("pending");
                        }
                      } catch {
                        setState("pending");
                      }
                    }}
                  >
                    Activate Pro Access
                  </Button>
                <Button onClick={() => window.location.reload()} variant="outline">
                  Refresh status
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dashboard">Go to dashboard</Link>
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}

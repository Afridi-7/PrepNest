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
import { Link, useSearchParams } from "react-router-dom";
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

export default function BillingSuccess() {
  const [search] = useSearchParams();
  // Safepay redirects with the URL we provided, which carries our own
  // Payment.id as ``?payment=<id>``. We poll /payments/status/<id> until
  // the webhook flips the row to "paid" (or we exhaust attempts).
  const paymentId = search.get("payment") ?? "";
  const tracker = search.get("tracker") ?? "";
  const queryClient = useQueryClient();
  const [state, setState] = useState<"checking" | "paid" | "pending">("checking");

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        // No id in the URL → just refresh /me and trust whatever it says.
        if (!paymentId && !tracker) {
          await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          const me = await apiClient.getCurrentUser();
          if (!cancelled) setState(me.is_pro ? "paid" : "pending");
          return;
        }
        const v = paymentId
          ? await apiClient.getPaymentStatus(paymentId)
          : await apiClient.verifyCheckout(tracker);
        if (cancelled) return;
        if (v.status === "paid" || v.is_pro) {
          await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
          setState("paid");
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
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
                  <Link to="/dashboard">
                    <Crown className="h-4 w-4 mr-2" /> Go to dashboard
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
                Safepay is finalising your transaction. This usually takes only a few
                seconds — refresh in a moment to see your Pro access activate.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => window.location.reload()} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700">
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

/**
 * Pricing — public marketing-style page that lists subscription plans and
 * launches a Safepay checkout when the user clicks "Upgrade".
 *
 * Design: matches the rest of the app — blue / cyan / indigo gradients,
 * rounded-3xl cards, white/85 backdrop-blur surfaces, framer-motion stagger.
 *
 * Behaviour:
 *   • Anonymous → "Sign in" CTA (redirects to /login with a return state).
 *   • Logged-in non-Pro → "Upgrade" CTA calls
 *     `apiClient.createCheckoutSession` and navigates the browser to the
 *     hosted Safepay checkout URL.
 *   • Already-Pro user → CTA is disabled and a "You're on Pro" badge is shown.
 *
 * Security: never trusts client-side prices — the backend validates the
 * `plan_code` and resolves the amount before creating the order.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Crown, Loader2, Sparkles, ShieldCheck, Zap, Star, Gift, X } from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { apiClient, type SubscriptionPlan } from "@/services/api";
import { useCurrentUser, useIsPro } from "@/hooks/use-current-user";

const FREE_FEATURES: { label: string; included: boolean }[] = [
  { label: "Browse all study materials & past papers", included: true },
  { label: "Read every Query Room question & answer", included: true },
  { label: "10 practice MCQs per day", included: true },
  { label: "Limited AI Tutor messages (5 / day)", included: true },
  { label: "Track streaks and earn rewards", included: true },
  { label: "Post or answer in the Query Room", included: false },
  { label: "Unlimited AI Tutor & full mock tests", included: false },
  { label: "AI essay evaluation & premium notes", included: false },
];

const PRO_FEATURES: string[] = [
  "Unlimited AI Tutor messages — solve any doubt, anytime",
  "Full mock tests with AI-graded essay evaluation",
  "Unlimited daily practice quizzes (no 10/day cap)",
  "All past papers + premium curated notes",
  "Post questions and answer in the Query Room",
  "Personalised weakness analysis & study plan",
  "Priority email support",
  "All future Pro features at no extra cost",
];

export default function Pricing() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const isPro = useIsPro();
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getSubscriptionPlans()
      .then((p) => {
        if (!cancelled) setPlans(p);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load plans. Please refresh.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (!user) {
      navigate("/login", { state: { from: "/pricing", reason: "auth-required" } });
      return;
    }
    if (isPro) {
      toast.success("You're already on Pro — enjoy!");
      return;
    }
    setLoadingPlan(plan.code);
    try {
      const session = await apiClient.createCheckoutSession(plan.code);
      // Safepay's hosted checkout sets frame-blocking headers and is meant
      // for top-level navigation. Redirect the whole page; Safepay will
      // bring the user back to /billing/success or /billing/cancel.
      window.location.assign(session.redirect_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start checkout.";
      toast.error(msg);
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-cyan-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden pt-24 pb-12 px-4">
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 backdrop-blur px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm dark:bg-slate-900/70 dark:border-blue-900 dark:text-blue-300"
          >
            <Sparkles className="h-3.5 w-3.5" /> Premium plans
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-4 text-4xl sm:text-5xl font-black tracking-tight bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 bg-clip-text text-transparent"
          >
            Unlock your full potential
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-300"
          >
            Pick the plan that fits your prep. Cancel anytime — no hidden fees.
          </motion.p>
          {!user && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm"
            >
              <Gift className="h-4 w-4" />
              New here? Sign up and get <span className="underline">3 days of Pro for free</span> — no card needed.
            </motion.div>
          )}
        </div>
      </section>

      {/* Plans */}
      <section className="px-4 pb-20">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              {error}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Free tier */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="relative rounded-3xl border border-slate-200 bg-white/85 backdrop-blur p-6 shadow-md dark:border-slate-800 dark:bg-slate-900/70"
            >
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Star className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Free</h3>
              </div>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">PKR 0</p>
              <p className="text-xs text-slate-500">Forever. No card required.</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">What you get</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {FREE_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2">
                    {f.included ? (
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span className={f.included ? "" : "text-slate-400 line-through"}>{f.label}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="mt-6 w-full"
                onClick={() => navigate(user ? "/dashboard" : "/signup")}
              >
                {user ? "Go to dashboard" : "Start 3-day free trial"}
              </Button>
            </motion.div>

            {/* Paid plans (rendered from server) */}
            {plans === null
              ? Array.from({ length: 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl border border-slate-200 bg-white/60 p-6 shadow-md animate-pulse dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="h-10 w-10 rounded-2xl bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-4 h-7 w-32 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-3 h-9 w-40 rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="mt-6 space-y-2">
                      {Array.from({ length: 6 }).map((__, j) => (
                        <div key={j} className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800" />
                      ))}
                    </div>
                    <div className="mt-6 h-10 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
                  </div>
                ))
              : plans.map((plan, idx) => {
                  const isHighlight = plan.highlight;
                  return (
                    <motion.div
                      key={plan.code}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.05 * (idx + 1) }}
                      className={[
                        "relative rounded-3xl p-6 shadow-md transition",
                        isHighlight
                          ? "border-2 border-transparent bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-600 text-white shadow-2xl shadow-blue-500/30"
                          : "border border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70",
                      ].join(" ")}
                    >
                      {plan.badge && (
                        <div className="absolute -top-3 right-4 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-amber-950 shadow">
                          {plan.badge}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div
                          className={[
                            "flex h-10 w-10 items-center justify-center rounded-2xl",
                            isHighlight
                              ? "bg-white/20 text-white"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
                          ].join(" ")}
                        >
                          <Crown className="h-5 w-5" />
                        </div>
                        <h3
                          className={[
                            "text-lg font-bold",
                            isHighlight ? "text-white" : "text-slate-900 dark:text-white",
                          ].join(" ")}
                        >
                          {plan.name}
                        </h3>
                      </div>
                      <p
                        className={[
                          "mt-3 text-3xl font-black",
                          isHighlight ? "text-white" : "text-slate-900 dark:text-white",
                        ].join(" ")}
                      >
                        {plan.price_display}
                        <span className={["text-sm font-semibold ml-1", isHighlight ? "text-blue-100" : "text-slate-500"].join(" ")}>
                          / month
                        </span>
                      </p>
                      <p className={isHighlight ? "text-xs text-blue-50/90" : "text-xs text-slate-500"}>
                        Billed every {plan.interval_days} days. Cancel anytime.
                      </p>

                      <p
                        className={[
                          "mt-4 text-xs font-semibold uppercase tracking-wider",
                          isHighlight ? "text-blue-100" : "text-slate-500",
                        ].join(" ")}
                      >
                        Everything in Free, plus
                      </p>
                      <ul
                        className={[
                          "mt-2 space-y-2 text-sm",
                          isHighlight ? "text-blue-50" : "text-slate-700 dark:text-slate-300",
                        ].join(" ")}
                      >
                        {PRO_FEATURES.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <Check
                              className={[
                                "h-4 w-4 shrink-0 mt-0.5",
                                isHighlight ? "text-white" : "text-emerald-600",
                              ].join(" ")}
                            />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        className={[
                          "mt-6 w-full font-semibold rounded-xl",
                          isHighlight
                            ? "bg-white text-blue-700 hover:bg-blue-50"
                            : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white",
                        ].join(" ")}
                        disabled={loadingPlan === plan.code || isPro}
                        onClick={() => handleUpgrade(plan)}
                      >
                        {loadingPlan === plan.code ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redirecting…
                          </>
                        ) : isPro ? (
                          <>You're on Pro</>
                        ) : !user ? (
                          <>Sign in to upgrade</>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" /> Upgrade to {plan.name}
                          </>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
          </div>

          {/* Trust strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure checkout via Safepay
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> Cancel anytime
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" /> Instant activation
            </span>
          </motion.div>

          {/* FAQ */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-2xl font-black text-center text-slate-900 dark:text-white">
              Frequently asked questions
            </h2>
            <div className="mt-6 space-y-3">
              {[
                {
                  q: "Is my payment information secure?",
                  a: "Yes. All payments are processed by Safepay over an encrypted connection. We never see or store your card details — only the transaction outcome.",
                },
                {
                  q: "Can I cancel my subscription?",
                  a: "Yes. Pro access stays active for the period you've paid for. You can stop renewing at any time from your account settings.",
                },
                {
                  q: "Do you offer refunds?",
                  a: "If something went wrong, contact us within 7 days at the email on the Contact page and we'll review your case.",
                },
                {
                  q: "What happens to my data if I downgrade?",
                  a: "Nothing — your account, history and uploaded notes are preserved. You simply lose access to Pro-only features.",
                },
              ].map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-slate-200 bg-white/85 backdrop-blur p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{item.q}</span>
                    <span className="ml-4 text-blue-600 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-8 text-center text-xs text-slate-500">
              Questions? <Link to="/contact" className="text-blue-600 hover:underline">Contact us</Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

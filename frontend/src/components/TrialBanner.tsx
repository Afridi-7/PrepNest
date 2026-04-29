/**
 * TrialBanner — sticky callout that appears on every authenticated page
 * while a user is on the 3-day free Pro trial. Shows a live countdown and a
 * direct path to the Pricing page so users know:
 *   1. They have Pro right now (no surprises).
 *   2. Exactly when it expires.
 *   3. How to subscribe before it does.
 *
 * Hidden for: anonymous visitors, paying Pro users, admins, and users whose
 * trial has already ended (they revert to Free naturally).
 *
 * State source: `/users/me` exposes `is_on_trial` and
 * `subscription_expires_at`. We refresh the countdown every 30s so users see
 * the timer tick down without hammering the server.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Sparkles, X } from "lucide-react";

import { useCurrentUser } from "@/hooks/use-current-user";

// Once a user dismisses the trial banner we never show it to them again
// (it's a one-time onboarding nudge, not a recurring ad). The key is
// scoped per-user so different accounts on the same browser get their
// own dismissal state.
const DISMISS_KEY_PREFIX = "prepnest:trial_banner_dismissed_for:";

function dismissKeyFor(userId: string | number | undefined): string | null {
  return userId !== undefined && userId !== null ? `${DISMISS_KEY_PREFIX}${userId}` : null;
}

function formatRemaining(expires: Date): { label: string; urgent: boolean } | null {
  const now = Date.now();
  const ms = expires.getTime() - now;
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;
  const urgent = ms < 24 * 60 * 60 * 1000;
  if (days >= 1) return { label: `${days}d ${hours}h left`, urgent };
  if (hours >= 1) return { label: `${hours}h ${minutes}m left`, urgent };
  return { label: `${minutes}m left`, urgent };
}

export function TrialBanner() {
  const { data: user } = useCurrentUser();
  const [, force] = useState(0);
  const [dismissed, setDismissed] = useState<boolean>(false);

  // Re-evaluate dismissal whenever the logged-in user changes — different
  // accounts on the same browser have their own state, and a fresh login
  // mustn't carry the previous user's dismissal flag forward.
  useEffect(() => {
    const key = dismissKeyFor(user?.id);
    if (!key) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(localStorage.getItem(key) === "1");
    } catch {
      setDismissed(false);
    }
  }, [user?.id]);

  // Tick the countdown once a minute. We keep this lightweight — no network.
  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const remaining = useMemo(() => {
    if (!user?.is_on_trial || !user.subscription_expires_at) return null;
    const exp = new Date(user.subscription_expires_at);
    if (Number.isNaN(exp.getTime())) return null;
    return formatRemaining(exp);
  }, [user]);

  if (!user || !user.is_on_trial || !remaining || dismissed) return null;

  const onDismiss = () => {
    const key = dismissKeyFor(user.id);
    if (key) {
      try {
        localStorage.setItem(key, "1");
      } catch {
        // ignore quota / privacy-mode errors
      }
    }
    setDismissed(true);
  };

  return (
    <div
      className={[
        "sticky top-16 z-40 border-b backdrop-blur",
        remaining.urgent
          ? "border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50"
          : "border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50",
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="container mx-auto flex flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-slate-800">
          <span
            className={[
              "inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow-sm",
              remaining.urgent
                ? "bg-gradient-to-br from-amber-500 to-orange-600"
                : "bg-gradient-to-br from-blue-600 to-cyan-600",
            ].join(" ")}
          >
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="leading-tight">
            <span className="font-semibold">You're on the Pro free trial</span>
            {" — "}
            <span className={remaining.urgent ? "font-semibold text-amber-700" : "text-slate-600"}>
              {remaining.label}
            </span>
            <span className="hidden text-slate-500 sm:inline">. Subscribe before it ends to keep every Pro feature.</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:from-blue-700 hover:to-cyan-700"
          >
            <Crown className="h-3.5 w-3.5" /> Subscribe — PKR 850/mo
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss trial banner"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-white hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrialBanner;

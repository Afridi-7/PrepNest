/**
 * Pro-only upgrade affordances.
 *
 * Two pieces:
 *  - `<ProUpgradeBanner />`: an inline banner shown above feature surfaces
 *    when the current user is logged-in but not Pro. Pages using it just
 *    drop it in; no per-page styling needed.
 *  - `useRequirePro()`: imperative gate for click handlers. Returns a
 *    function `requirePro(action)` that toasts an upgrade message and
 *    returns `false` when the user can't proceed.
 *
 * Both rely on `useCurrentUser` so the cache is shared with everything else.
 */

import { Crown, Lock, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useCurrentUser, useIsPro } from "@/hooks/use-current-user";

export function ProUpgradeBanner({
  description = "You can read every question and reply, but interactive features are Pro-only. Upgrade to join the conversation.",
}: {
  description?: string;
}) {
  const { data } = useCurrentUser();
  const isPro = useIsPro();
  // Only show the banner to authed-but-not-pro users. Anonymous users get
  // a sign-in prompt from the action handler instead — showing a Pro banner
  // before they've even logged in would be misleading.
  if (!data || isPro) return null;
  return (
    <div className="mb-4 flex flex-col sm:flex-row items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
        <Lock className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900">
          Browsing as a free member
        </p>
        <p className="mt-0.5 text-xs text-amber-800">{description}</p>
      </div>
      <Link
        to="/pricing"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:from-blue-700 hover:to-cyan-700"
      >
        <Sparkles className="h-3.5 w-3.5" /> See Pro plans
      </Link>
    </div>
  );
}

/** Imperative gate. Use inside event handlers. */
export function useRequirePro() {
  const { data } = useCurrentUser();
  const isPro = useIsPro();
  const navigate = useNavigate();

  return (action: string): boolean => {
    if (!data) {
      toast.error(`Sign in to ${action}.`);
      return false;
    }
    if (!isPro) {
      toast.error(`Upgrade to Pro to ${action}.`, {
        description: "Free accounts can browse but cannot post or vote.",
        action: {
          label: "See plans",
          onClick: () => navigate("/pricing"),
        },
      });
      return false;
    }
    return true;
  };
}

/** Compact "Upgrade to Pro" pill button that links to /pricing. */
export function ProUpgradeButton({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/pricing"
      className={[
        "inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:from-blue-700 hover:to-cyan-700",
        className,
      ].join(" ")}
    >
      <Crown className="h-3.5 w-3.5" /> Upgrade to Pro
    </Link>
  );
}

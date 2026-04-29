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

import { Lock } from "lucide-react";
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
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
        <Lock className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-900">
          Browsing as a free member
        </p>
        <p className="mt-0.5 text-xs text-amber-800">{description}</p>
      </div>
    </div>
  );
}

/** Imperative gate. Use inside event handlers. */
export function useRequirePro() {
  const { data } = useCurrentUser();
  const isPro = useIsPro();

  return (action: string): boolean => {
    if (!data) {
      toast.error(`Sign in to ${action}.`);
      return false;
    }
    if (!isPro) {
      toast.error(`Upgrade to Pro to ${action}.`, {
        description: "Free accounts can browse but cannot post or vote.",
      });
      return false;
    }
    return true;
  };
}

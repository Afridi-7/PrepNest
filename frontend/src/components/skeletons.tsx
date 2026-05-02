import { type ReactNode } from "react";
import { motion } from "framer-motion";

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted/60 ${className}`} aria-hidden />
);

const SkeletonRow = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full items-center gap-3">{children}</div>
);

/** Empty-state primitive used by listing pages when a query returns []. */
export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-center">
    <h3 className="text-lg font-semibold">{title}</h3>
    {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

/** Generic retry CTA for query errors. */
export const RetryButton = ({ onRetry, label = "Try again" }: { onRetry: () => void; label?: string }) => (
  <button
    type="button"
    onClick={onRetry}
    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
  >
    {label}
  </button>
);

export const DashboardSkeleton = () => (
  <div className="space-y-6 p-6">
    <SkeletonBlock className="h-8 w-1/3" />
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} className="h-28" />
      ))}
    </div>
    <SkeletonBlock className="h-64" />
  </div>
);

export const MCQListSkeleton = ({ rows = 6 }: { rows?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="rounded-md border p-4">
        <SkeletonBlock className="mb-3 h-4 w-3/4" />
        <SkeletonBlock className="mb-2 h-3 w-1/2" />
        <SkeletonBlock className="h-3 w-1/3" />
      </div>
    ))}
  </div>
);

export const MockTestSkeleton = () => (
  <div className="space-y-4 p-6">
    <SkeletonBlock className="h-8 w-1/2" />
    <SkeletonBlock className="h-4 w-1/3" />
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <SkeletonBlock key={i} className="h-20" />
      ))}
    </div>
  </div>
);

/**
 * Full-page loading skeleton shown by the global Suspense boundary while a
 * lazy route chunk is being downloaded. Renders a Navbar-shaped header and
 * shimmer content blocks so the page never goes fully blank.
 *
 * An animated blue progress bar at the very top gives users immediate
 * feedback that something is happening — the same pattern used by GitHub,
 * YouTube, and Notion.
 */
export const PageLoadingSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Thin progress bar sweeping across the top */}
    <motion.div
      className="fixed top-0 left-0 right-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-blue-500 to-cyan-400"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 0.85 }}
      transition={{ duration: 1.8, ease: [0.25, 1, 0.5, 1] }}
    />

    {/* Navbar ghost */}
    <div className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg dark:border-slate-800/60 dark:bg-slate-950/80">
      <div className="container mx-auto flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <div className="flex flex-col gap-1.5">
            <SkeletonBlock className="h-3.5 w-20" />
            <SkeletonBlock className="h-2 w-14" />
          </div>
        </div>
        <SkeletonBlock className="hidden h-8 w-64 rounded-2xl md:block" />
        <SkeletonBlock className="h-8 w-20 rounded-lg" />
      </div>
    </div>

    {/* Page body */}
    <div className="pt-16">
      <DashboardSkeleton />
    </div>
  </div>
);

export const QueryRoomSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="rounded-md border p-4">
        <SkeletonRow>
          <SkeletonBlock className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-1/4" />
            <SkeletonBlock className="h-3 w-3/4" />
          </div>
        </SkeletonRow>
      </div>
    ))}
  </div>
);

export const AITutorSkeleton = () => (
  <div className="flex h-full flex-col gap-3 p-4">
    {[0, 1, 2].map((i) => (
      <div key={i} className={`max-w-[70%] rounded-lg p-3 ${i % 2 ? "self-end" : ""}`}>
        <SkeletonBlock className="mb-2 h-3 w-32" />
        <SkeletonBlock className="h-3 w-64" />
      </div>
    ))}
  </div>
);

export default {
  DashboardSkeleton,
  MCQListSkeleton,
  MockTestSkeleton,
  QueryRoomSkeleton,
  AITutorSkeleton,
  EmptyState,
  RetryButton,
};

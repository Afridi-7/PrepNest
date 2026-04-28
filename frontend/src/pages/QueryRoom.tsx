import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUp,
  Calendar,
  Crown,
  Flame,
  Hash,
  HelpCircle,
  Lock,
  MessageSquare,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  apiClient,
  type QueryLeaderEntry,
  type QueryOption,
  type QueryQuestion,
  type QueryQuestionCreate,
  type QueryReply,
  type UserProfile,
} from "@/services/api";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["from-blue-500", "to-indigo-600"],
  ["from-purple-500", "to-pink-500"],
  ["from-emerald-500", "to-teal-600"],
  ["from-amber-500", "to-orange-600"],
  ["from-rose-500", "to-red-600"],
  ["from-cyan-500", "to-blue-600"],
  ["from-violet-500", "to-purple-700"],
  ["from-lime-500", "to-emerald-600"],
];

const hashCode = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const gradientFor = (id: string): string => {
  const [a, b] = AVATAR_GRADIENTS[hashCode(id) % AVATAR_GRADIENTS.length];
  return `${a} ${b}`;
};

const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
};

const formatRelative = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const parseTagsInput = (raw: string): string[] =>
  raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 6);

const nextResetLabel = (): string => {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = Math.max(
    1,
    Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );
  return `in ${days}d`;
};

const Avatar = ({
  id,
  name,
  size = "md",
}: {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) => {
  const dim =
    size === "lg" ? "h-12 w-12 text-base" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradientFor(
        id
      )} font-bold text-white shadow-sm ring-2 ring-white ${dim}`}
    >
      {initialsOf(name)}
    </div>
  );
};

type SortMode = "new" | "top" | "unanswered" | "mine";

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const QueryRoom = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTag = searchParams.get("tag") || "";
  const [composerOpen, setComposerOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>("new");

  const meQuery = useQuery<UserProfile>({
    queryKey: ["users", "me"],
    queryFn: () => apiClient.getCurrentUser(),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  const meId = meQuery.data ? String(meQuery.data.id) : null;
  const isAdmin = !!meQuery.data?.is_admin;
  const isPro = !!meQuery.data?.is_pro || isAdmin;

  /**
   * Gate write/vote actions to authed pro users. Returns true if the action
   * may proceed; otherwise shows an upgrade/sign-in toast and returns false.
   */
  const requirePro = (action: string): boolean => {
    if (!meId) {
      toast.error(`Sign in to ${action}.`);
      return false;
    }
    if (!isPro) {
      toast.error(`Upgrade to Pro to ${action}.`, {
        description: "Free accounts can browse questions and replies.",
      });
      return false;
    }
    return true;
  };

  const questionsQuery = useQuery({
    queryKey: ["query-room", "questions", activeTag],
    queryFn: () =>
      apiClient.listQueryQuestions({
        tag: activeTag || undefined,
        limit: 50,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const myQuestionsQuery = useQuery({
    queryKey: ["query-room", "questions", "mine"],
    queryFn: () => apiClient.listMyQueryQuestions(50),
    enabled: !!meId && sort === "mine",
    staleTime: 30_000,
  });

  const tagsQuery = useQuery({
    queryKey: ["query-room", "tags"],
    queryFn: () => apiClient.getQueryTags(20),
    staleTime: 5 * 60_000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ["query-room", "leaderboard"],
    queryFn: () => apiClient.getQueryLeaderboard(50),
    staleTime: 60_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["query-room"] });
  };

  const setTag = (tag: string | null) => {
    if (tag) setSearchParams({ tag });
    else setSearchParams({});
  };

  const createQuestion = useMutation({
    mutationFn: (payload: QueryQuestionCreate) =>
      apiClient.createQueryQuestion(payload),
    onSuccess: () => {
      toast.success("Question posted");
      setComposerOpen(false);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const baseItems =
    sort === "mine"
      ? (myQuestionsQuery.data?.items ?? [])
      : (questionsQuery.data?.items ?? []);
  const sortedItems = useMemo(() => {
    const list = [...baseItems];
    if (sort === "top") {
      list.sort((a, b) => b.upvotes - a.upvotes || b.reply_count - a.reply_count);
    } else if (sort === "unanswered") {
      return list.filter((q) => q.reply_count === 0);
    }
    // "new" / "mine" = backend already returns newest first
    return list;
  }, [baseItems, sort]);

  const totalAnswers = baseItems.reduce((s, q) => s + q.reply_count, 0);

  const period = leaderboardQuery.data?.period_label || "";
  const allEntries = leaderboardQuery.data?.entries ?? [];
  const podium = allEntries.slice(0, 3);
  const restOfBoard = allEntries.slice(3, 10);
  const myRankIndex = meId
    ? allEntries.findIndex((e) => String(e.user_id) === meId)
    : -1;
  const myEntry = myRankIndex >= 0 ? allEntries[myRankIndex] : null;
  const maxTagCount = Math.max(1, ...(tagsQuery.data ?? []).map((t) => t.count));

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen pt-20 pb-16 page-bg-gradient">
        <div className="container mx-auto max-w-7xl px-4">
          {/* ── Hero ─────────────────────────────────────────── */}
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 p-6 text-white shadow-2xl shadow-blue-500/25 md:p-8">
            <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl" />

            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  Community Q&amp;A
                </div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Query Room
                </h1>
                <p className="mt-2 max-w-xl text-sm text-blue-100 md:text-base">
                  Ask questions, post MCQs, and answer your peers. Earn points
                  every time you help someone — top contributors are featured
                  every month on the leaderboard.
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-xs">
                  <Stat icon={<HelpCircle className="h-3.5 w-3.5" />} label={`${baseItems.length} questions`} />
                  <Stat icon={<MessageSquare className="h-3.5 w-3.5" />} label={`${totalAnswers} answers`} />
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  onClick={() => {
                    if (composerOpen) {
                      setComposerOpen(false);
                      return;
                    }
                    if (!requirePro("ask a question")) return;
                    setComposerOpen(true);
                  }}
                  size="lg"
                  className="bg-white text-indigo-700 shadow-lg hover:bg-blue-50"
                  title={
                    !meId
                      ? "Sign in to ask a question"
                      : !isPro
                        ? "Upgrade to Pro to ask a question"
                        : undefined
                  }
                >
                  {composerOpen ? (
                    <>
                      <X className="mr-2 h-4 w-4" /> Close
                    </>
                  ) : !meId || !isPro ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Ask Question
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" /> Ask Question
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Free-tier upgrade banner ──────────────────────── */}
          {meId && !isPro && (
            <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white">
                <Lock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">
                  Browsing as a free member
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  You can read every question and reply, but asking, answering,
                  and upvoting are Pro-only features. Upgrade to join the
                  conversation.
                </p>
              </div>
            </div>
          )}

          {/* ── Composer ──────────────────────────────────────── */}
          <AnimatePresence>
            {composerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <Composer
                  submitting={createQuestion.isPending}
                  onSubmit={(payload) => createQuestion.mutate(payload)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Active filter ─────────────────────────────────── */}
          {activeTag && (
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                <Hash className="h-3.5 w-3.5" />
                Filtering by #{activeTag}
              </span>
              <button
                onClick={() => setTag(null)}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                <X className="h-3 w-3" /> clear filter
              </button>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* ── FEED ─────────────────────────────────────────── */}
            <div className="flex min-w-0 flex-col gap-4">
              {/* Sort tabs */}
              <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur-sm">
                <SortTab active={sort === "new"} onClick={() => setSort("new")} icon={<Sparkles className="h-3.5 w-3.5" />} label="Newest" />
                <SortTab active={sort === "top"} onClick={() => setSort("top")} icon={<Flame className="h-3.5 w-3.5" />} label="Top" />
                <SortTab active={sort === "unanswered"} onClick={() => setSort("unanswered")} icon={<HelpCircle className="h-3.5 w-3.5" />} label="Unanswered" />
                {meId && (
                  <SortTab active={sort === "mine"} onClick={() => setSort("mine")} icon={<UserIcon className="h-3.5 w-3.5" />} label="My Questions" />
                )}
              </div>

              {questionsQuery.isLoading && (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-8 text-center text-slate-500 shadow-sm">
                  Loading questions…
                </div>
              )}
              {questionsQuery.isError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
                  Failed to load questions. Make sure the backend is running on port 8000.
                </div>
              )}
              {!questionsQuery.isLoading && sortedItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
                    <MessageSquare className="h-8 w-8 text-indigo-500" />
                  </div>
                  <p className="text-lg font-semibold text-slate-800">
                    {sort === "unanswered"
                      ? "Everything's been answered!"
                      : sort === "mine"
                        ? "You haven't asked anything yet"
                        : activeTag
                          ? `No questions yet for #${activeTag}`
                          : "No questions yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {sort === "unanswered"
                      ? "Try a different filter, or ask a new question."
                      : sort === "mine"
                        ? "Click \u201cAsk Question\u201d above to get started."
                        : "Be the first to ask and earn 10 points!"}
                  </p>
                </div>
              )}
              {sortedItems.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  meId={meId}
                  isAdmin={isAdmin}
                  isPro={isPro}
                  requirePro={requirePro}
                  onTagClick={(t) => setTag(t)}
                  onChanged={invalidateAll}
                />
              ))}
            </div>

            {/* ── SIDEBAR ──────────────────────────────────────── */}
            <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
              {/* Leaderboard */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="relative bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-4 text-white">
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-5 w-5" />
                      <h2 className="text-base font-bold">Top 10 This Month</h2>
                    </div>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide backdrop-blur">
                      Live
                    </span>
                  </div>
                  <div className="relative mt-1 flex items-center gap-1.5 text-xs text-amber-50">
                    <Calendar className="h-3 w-3" />
                    {period || "This Month"} · resets {nextResetLabel()}
                  </div>
                </div>

                <div className="p-4">
                  {leaderboardQuery.isLoading && (
                    <div className="space-y-2">
                      {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                          <div className="h-3 flex-1 animate-pulse rounded bg-slate-200" />
                        </div>
                      ))}
                    </div>
                  )}
                  {leaderboardQuery.data && allEntries.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-500">
                      No activity yet this month — start posting to climb the
                      board!
                    </p>
                  )}

                  {/* Podium top-3 */}
                  {podium.length > 0 && <Podium entries={podium} meId={meId} />}

                  {/* Rows 4..10 */}
                  {restOfBoard.length > 0 && (
                    <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                      {restOfBoard.map((e, i) => {
                        const rank = i + 4;
                        const isMe = meId !== null && String(e.user_id) === meId;
                        return (
                          <li
                            key={e.user_id}
                            className={`flex items-center gap-3 rounded-lg px-2 py-1.5 transition ${
                              isMe
                                ? "bg-blue-50 ring-1 ring-blue-200"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                              {rank}
                            </span>
                            <Avatar id={String(e.user_id)} name={e.user_name} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {e.user_name}
                                {isMe && (
                                  <span className="ml-1.5 rounded bg-blue-600 px-1 py-px text-[9px] font-bold uppercase text-white">
                                    you
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {e.posts}q · {e.replies}a · ↑{e.upvotes_received ?? 0}
                              </p>
                            </div>
                            <span className="text-sm font-bold text-blue-600">
                              {e.points}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {/* Your rank — always shown when logged in */}
                  {meId && allEntries.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Your rank
                      </p>
                      {myEntry ? (
                        <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                            #{myRankIndex + 1}
                          </span>
                          <Avatar id={String(myEntry.user_id)} name={myEntry.user_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              You
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {myEntry.posts}q · {myEntry.replies}a · ↑{myEntry.upvotes_received ?? 0}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-blue-600">
                            {myEntry.points}
                          </span>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
                          Unranked — post or reply to climb the board.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Tag cloud */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-purple-500" />
                    <h2 className="text-sm font-bold text-slate-900">
                      Browse by Subject
                    </h2>
                  </div>
                  {activeTag && (
                    <button
                      onClick={() => setTag(null)}
                      className="text-xs font-medium text-slate-400 hover:text-slate-700"
                    >
                      reset
                    </button>
                  )}
                </div>
                {tagsQuery.isLoading && (
                  <p className="text-sm text-slate-500">Loading…</p>
                )}
                {tagsQuery.data && tagsQuery.data.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Tags will appear here as people post. Add hashtags like{" "}
                    <span className="font-mono text-xs">#math</span> or{" "}
                    <span className="font-mono text-xs">#physics</span> to your
                    questions.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {tagsQuery.data?.map((t) => {
                    const active = t.tag === activeTag;
                    const ratio = t.count / maxTagCount;
                    const sizeCls =
                      ratio > 0.66
                        ? "px-3.5 py-1.5 text-sm"
                        : ratio > 0.33
                          ? "px-3 py-1 text-sm"
                          : "px-2.5 py-0.5 text-xs";
                    return (
                      <button
                        key={t.tag}
                        onClick={() => setTag(active ? null : t.tag)}
                        className={`inline-flex items-center gap-1 rounded-full font-semibold transition ${sizeCls} ${
                          active
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                            : "bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-700"
                        }`}
                      >
                        <Hash className="h-3 w-3" />
                        {t.tag}
                        <span
                          className={`ml-0.5 rounded-full px-1.5 text-[10px] ${
                            active ? "bg-white/20" : "bg-white/70 text-slate-500"
                          }`}
                        >
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scoring info */}
              <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50/40 p-5 shadow-sm">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  How points work
                </h3>
                <ul className="space-y-1 text-xs text-slate-600">
                  <li className="flex justify-between"><span>Post a question</span><span className="font-semibold text-slate-800">+10</span></li>
                  <li className="flex justify-between"><span>Answer someone</span><span className="font-semibold text-slate-800">+5</span></li>
                  <li className="flex justify-between"><span>Upvote on your question</span><span className="font-semibold text-slate-800">+5</span></li>
                  <li className="flex justify-between"><span>Upvote on your answer</span><span className="font-semibold text-slate-800">+3</span></li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default QueryRoom;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const Stat = ({ icon, label }: { icon: React.ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur-sm">
    {icon}
    {label}
  </span>
);

const SortTab = ({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
      active
        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100"
    }`}
  >
    {icon}
    {label}
  </button>
);

const Podium = ({ entries, meId }: { entries: QueryLeaderEntry[]; meId: string | null }) => {
  // Render order: 2nd, 1st, 3rd (so #1 is centered & taller)
  const arr = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <div className="grid grid-cols-3 items-end gap-2">
      {arr.map((e) => {
        const rank =
          e.user_id === entries[0]?.user_id
            ? 1
            : e.user_id === entries[1]?.user_id
              ? 2
              : 3;
        const heightCls = rank === 1 ? "pt-2" : "pt-5";
        const ringCls =
          rank === 1
            ? "ring-2 ring-amber-400"
            : rank === 2
              ? "ring-2 ring-slate-300"
              : "ring-2 ring-orange-300";
        const medalBg =
          rank === 1
            ? "bg-gradient-to-br from-amber-300 to-amber-500"
            : rank === 2
              ? "bg-gradient-to-br from-slate-200 to-slate-400"
              : "bg-gradient-to-br from-orange-300 to-orange-500";
        const isMe = meId !== null && String(e.user_id) === meId;
        return (
          <div key={e.user_id} className={`flex flex-col items-center ${heightCls}`}>
            <div className="relative">
              {rank === 1 && (
                <Crown className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 fill-amber-400 text-amber-500" />
              )}
              <div className={`rounded-full ${ringCls}`}>
                <Avatar id={String(e.user_id)} name={e.user_name} size={rank === 1 ? "lg" : "md"} />
              </div>
              <span
                className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow ${medalBg}`}
              >
                {rank}
              </span>
            </div>
            <p className="mt-2 max-w-full truncate text-center text-xs font-semibold text-slate-800">
              {e.user_name}
              {isMe && (
                <span className="ml-1 rounded bg-blue-600 px-1 py-px text-[8px] font-bold uppercase text-white">
                  you
                </span>
              )}
            </p>
            <p className="text-[10px] font-bold text-blue-600">{e.points} pts</p>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Composer
// ─────────────────────────────────────────────────────────────────────────────

interface ComposerProps {
  submitting: boolean;
  onSubmit: (payload: QueryQuestionCreate) => void;
}

const Composer = ({ submitting, onSubmit }: ComposerProps) => {
  const [qType, setQType] = useState<"open" | "mcq">("open");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [options, setOptions] = useState<QueryOption[]>([
    { label: "A", text: "" },
    { label: "B", text: "" },
    { label: "C", text: "" },
    { label: "D", text: "" },
  ]);
  const [correctLabel, setCorrectLabel] = useState<"A" | "B" | "C" | "D">("A");

  const handleSubmit = () => {
    if (title.trim().length < 5) {
      toast.error("Title must be at least 5 characters.");
      return;
    }
    if (body.trim().length < 1) {
      toast.error("Body cannot be empty.");
      return;
    }
    const tags = parseTagsInput(tagsRaw);
    if (qType === "mcq") {
      if (options.some((o) => o.text.trim().length === 0)) {
        toast.error("All four MCQ options are required.");
        return;
      }
      onSubmit({
        title: title.trim(),
        body: body.trim(),
        q_type: "mcq",
        options,
        correct_label: correctLabel,
        tags,
      });
    } else {
      onSubmit({
        title: title.trim(),
        body: body.trim(),
        q_type: "open",
        tags,
      });
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="mb-5 flex gap-2">
        <button
          type="button"
          onClick={() => setQType("open")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            qType === "open"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Open Question
        </button>
        <button
          type="button"
          onClick={() => setQType("mcq")}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            qType === "mcq"
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          MCQ
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="qr-title">Title</Label>
          <Input
            id="qr-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's your question?"
            maxLength={255}
          />
        </div>

        <div>
          <Label htmlFor="qr-body">Details</Label>
          <textarea
            id="qr-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder={
              qType === "mcq"
                ? "Add context for your MCQ (optional explanation, source, etc.)"
                : "Explain what you're stuck on. Include code or examples if helpful."
            }
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        {qType === "mcq" && (
          <div className="space-y-2">
            <Label>Options (tap a letter to mark the correct answer)</Label>
            {options.map((opt, idx) => (
              <div key={opt.label} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectLabel(opt.label)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition ${
                    correctLabel === opt.label
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-md"
                      : "border-slate-300 bg-white text-slate-600 hover:border-emerald-400"
                  }`}
                >
                  {opt.label}
                </button>
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = { ...opt, text: e.target.value };
                    setOptions(next);
                  }}
                  placeholder={`Option ${opt.label}`}
                  maxLength={300}
                />
              </div>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="qr-tags">Tags (up to 6, space- or comma-separated)</Label>
          <Input
            id="qr-tags"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="e.g. math physics calculus"
          />
          <p className="mt-1 text-xs text-slate-500">
            Tags help others discover your question by subject.
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={submitting} size="lg">
            {submitting ? "Posting…" : "Post Question"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// QuestionCard
// ─────────────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: QueryQuestion;
  meId: string | null;
  isAdmin: boolean;
  isPro: boolean;
  requirePro: (action: string) => boolean;
  onTagClick: (tag: string) => void;
  onChanged: () => void;
}

const QuestionCard = ({ question, meId, isAdmin, isPro, requirePro, onTagClick, onChanged }: QuestionCardProps) => {
  const queryClient = useQueryClient();
  const [showReplies, setShowReplies] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const detailQuery = useQuery({
    queryKey: ["query-room", "question", question.id],
    queryFn: () => apiClient.getQueryQuestion(question.id),
    enabled: showReplies,
    staleTime: 15_000,
  });

  const isAuthor = meId !== null && meId === question.author.id;
  const canDelete = isAuthor || isAdmin;

  const voteQuestion = useMutation({
    mutationFn: () => apiClient.voteQueryQuestion(question.id),
    onSuccess: () => onChanged(),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: () => apiClient.deleteQueryQuestion(question.id),
    onSuccess: () => {
      toast.success("Question deleted");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const postReply = useMutation({
    mutationFn: () =>
      apiClient.createQueryReply(question.id, { body: replyBody.trim() }),
    onSuccess: () => {
      setReplyBody("");
      toast.success("Reply posted");
      queryClient.invalidateQueries({
        queryKey: ["query-room", "question", question.id],
      });
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const detail = detailQuery.data;
  const replies = detail?.replies ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex">
        {/* Vote rail */}
        <div className="flex flex-col items-center gap-1 border-r border-slate-100 bg-slate-50/60 p-4">
          <button
            onClick={() => {
              if (!requirePro("upvote")) return;
              voteQuestion.mutate();
            }}
            disabled={isAuthor}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition ${
              question.has_upvoted
                ? "border-blue-500 bg-blue-500 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600"
            } ${isAuthor ? "cursor-not-allowed opacity-50" : ""}`}
            title={
              isAuthor
                ? "You can't upvote your own post"
                : !meId
                  ? "Sign in to upvote"
                  : !isPro
                    ? "Upgrade to Pro to upvote"
                    : "Upvote"
            }
          >
            {!meId || !isPro ? (
              <Lock className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </button>
          <span className="text-base font-bold text-slate-700">
            {question.upvotes}
          </span>
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1 p-5">
          {/* Author row */}
          <div className="mb-3 flex items-center gap-2.5">
            <Avatar id={question.author.id} name={question.author.name} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {question.author.name}
              </p>
              <p className="text-xs text-slate-500">
                {formatRelative(question.created_at)}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {question.q_type === "mcq" && (
                <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
                  MCQ
                </span>
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold leading-tight text-slate-900 group-hover:text-indigo-700">
            {question.title}
          </h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            {question.body}
          </p>

          {question.q_type === "mcq" && question.options && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {question.options.map((opt) => (
                <div
                  key={opt.label}
                  className="flex items-start gap-2.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm transition hover:border-indigo-200"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {opt.label}
                  </span>
                  <span className="text-slate-700">{opt.text}</span>
                </div>
              ))}
            </div>
          )}

          {question.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {question.tags.map((t) => (
                <button
                  key={t}
                  onClick={() => onTagClick(t)}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <Hash className="h-3 w-3" />
                  {t}
                </button>
              ))}
            </div>
          )}

          {/* Action row */}
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-sm">
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-blue-600"
            >
              <MessageSquare className="h-4 w-4" />
              {question.reply_count}{" "}
              {question.reply_count === 1 ? "reply" : "replies"}
              {showReplies ? " · hide" : ""}
            </button>
            {canDelete && (
              <button
                onClick={() => {
                  if (window.confirm("Delete this question?")) {
                    deleteQuestion.mutate();
                  }
                }}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-600"
              >
                {isAdmin && !isAuthor ? (
                  <Shield className="h-3.5 w-3.5" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {isAdmin && !isAuthor ? "Admin delete" : "Delete"}
              </button>
            )}
          </div>

          {/* Replies */}
          <AnimatePresence>
            {showReplies && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  {detailQuery.isLoading && (
                    <p className="text-sm text-slate-500">Loading replies…</p>
                  )}
                  {replies.length === 0 && !detailQuery.isLoading && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No replies yet. Be the first to help!
                    </p>
                  )}
                  {replies.map((r) => (
                    <ReplyCard
                      key={r.id}
                      reply={r}
                      question={question}
                      meId={meId}
                      isAdmin={isAdmin}
                      isPro={isPro}
                      requirePro={requirePro}
                      onChanged={() => {
                        queryClient.invalidateQueries({
                          queryKey: ["query-room", "question", question.id],
                        });
                        onChanged();
                      }}
                    />
                  ))}

                  <div className="flex gap-2 pt-1">
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={2}
                      maxLength={3000}
                      placeholder={
                        !meId
                          ? "Sign in to reply…"
                          : !isPro
                            ? "Upgrade to Pro to reply…"
                            : "Write a helpful reply…"
                      }
                      disabled={!meId || !isPro}
                      className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-50"
                    />
                    <Button
                      onClick={() => {
                        if (!requirePro("post a reply")) return;
                        if (replyBody.trim().length === 0) {
                          toast.error("Reply cannot be empty.");
                          return;
                        }
                        postReply.mutate();
                      }}
                      disabled={postReply.isPending}
                      className="self-end"
                    >
                      {postReply.isPending ? (
                        "…"
                      ) : !meId || !isPro ? (
                        <>
                          <Lock className="mr-1 h-3.5 w-3.5" /> Reply
                        </>
                      ) : (
                        "Reply"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ReplyCard
// ─────────────────────────────────────────────────────────────────────────────

interface ReplyCardProps {
  reply: QueryReply;
  question: QueryQuestion;
  meId: string | null;
  isAdmin: boolean;
  isPro: boolean;
  requirePro: (action: string) => boolean;
  onChanged: () => void;
}

const ReplyCard = ({ reply, meId, isAdmin, isPro, requirePro, onChanged }: ReplyCardProps) => {
  const isReplyAuthor = meId !== null && meId === reply.author.id;
  const canDelete = isReplyAuthor || isAdmin;

  const voteReply = useMutation({
    mutationFn: () => apiClient.voteQueryReply(reply.id),
    onSuccess: () => onChanged(),
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteReply = useMutation({
    mutationFn: () => apiClient.deleteQueryReply(reply.id),
    onSuccess: () => {
      toast.success("Reply deleted");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex gap-3 rounded-xl border-2 border-slate-200 bg-white p-3 transition">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => {
            if (!requirePro("upvote")) return;
            voteReply.mutate();
          }}
          disabled={isReplyAuthor}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition ${
            reply.has_upvoted
              ? "border-blue-500 bg-blue-500 text-white"
              : "border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:text-blue-600"
          } ${isReplyAuthor ? "cursor-not-allowed opacity-50" : ""}`}
          title={
            isReplyAuthor
              ? "You can't upvote your own reply"
              : !meId
                ? "Sign in to upvote"
                : !isPro
                  ? "Upgrade to Pro to upvote"
                  : "Upvote reply"
          }
        >
          {!meId || !isPro ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
        <span className="text-xs font-bold text-slate-700">{reply.upvotes}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Avatar id={reply.author.id} name={reply.author.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {reply.author.name}
            </p>
            <p className="text-xs text-slate-500">
              {formatRelative(reply.created_at)}
            </p>
          </div>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
          {reply.body}
        </p>
        {canDelete && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <button
              onClick={() => {
                if (window.confirm("Delete this reply?")) deleteReply.mutate();
              }}
              className="inline-flex items-center gap-1 text-slate-400 hover:text-red-600"
            >
              {isAdmin && !isReplyAuthor ? (
                <Shield className="h-3 w-3" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              {isAdmin && !isReplyAuthor ? "Admin delete" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

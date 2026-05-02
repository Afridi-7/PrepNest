import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen, Brain, Target, TrendingUp, Award, AlertTriangle, Flame,
  BarChart3, ArrowUpRight, Trophy, Lock, CheckCircle,
  Sparkles, Gift, Zap, Calendar, Rocket, Crown,
} from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { apiClient, type DashboardStats, type LeaderboardResponse, type UserRewards } from "@/services/api";

/* ── Pro Feature Gate ── */
const ProFeatureLocked = ({
  children,
  locked = true,
  label = "Unlock with Pro",
}: {
  children: ReactNode;
  locked?: boolean;
  label?: string;
}) => {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[3px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70 backdrop-blur-[2px] dark:bg-slate-900/70">
        <Lock className="h-5 w-5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <Link to="/pricing" className="mt-1 rounded-full px-4 py-1.5 text-[11px] font-bold text-white shadow-lg transition-transform hover:scale-105"
          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
          Upgrade
        </Link>
      </div>
    </div>
  );
};

/* ── Streak helper ── */
const STREAK_KEY_PREFIX = "prepnest_streak";
const streakKeyFor = (userKey: string) =>
  `${STREAK_KEY_PREFIX}::${userKey || "guest"}`;
const toDateStr = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

type StreakState = {
  current: number;
  best: number;
  lastActive: string;
  week: boolean[];
  // Day that is missing right before the current run — eligible for a Streak Saver.
  gapDate: string | null;
  // Streak length we'd recover if we filled gapDate. (current + run before gap)
  recoverableStreak: number;
};

function buildStreak(userKey: string, opts?: { extraDates?: string[] }): StreakState {
  const today = toDateStr(new Date());
  const storageKey = streakKeyFor(userKey);
  let data: { dates: string[]; best: number } = { dates: [], best: 0 };
  try {
    const s = localStorage.getItem(storageKey);
    if (s) data = JSON.parse(s);
    else {
      // One-time migration from the legacy shared key so existing users keep their streak.
      const legacy = localStorage.getItem(STREAK_KEY_PREFIX);
      if (legacy) {
        data = JSON.parse(legacy);
        localStorage.removeItem(STREAK_KEY_PREFIX);
      }
    }
  } catch { /* */ }
  if (!data.dates.includes(today)) data.dates.push(today);
  for (const d of opts?.extraDates ?? []) {
    if (!data.dates.includes(d)) data.dates.push(d);
  }
  data.dates.sort();
  if (data.dates.length > 365) data.dates = data.dates.slice(-365);

  // Current streak from today backwards
  let streak = 0;
  const cur = new Date();
  for (let i = 0; i < 366; i++) {
    if (data.dates.includes(toDateStr(cur))) { streak++; cur.setDate(cur.getDate() - 1); } else break;
  }
  // Detect a 1-day gap right before current streak that could be saved
  const gapCandidate = new Date();
  gapCandidate.setDate(gapCandidate.getDate() - streak);
  const gapStr = toDateStr(gapCandidate);
  let recoverable = streak;
  let gapDate: string | null = null;
  if (!data.dates.includes(gapStr)) {
    const beforeGap = new Date(gapCandidate);
    beforeGap.setDate(beforeGap.getDate() - 1);
    let runBefore = 0;
    for (let i = 0; i < 366; i++) {
      if (data.dates.includes(toDateStr(beforeGap))) { runBefore++; beforeGap.setDate(beforeGap.getDate() - 1); } else break;
    }
    if (runBefore > 0) {
      gapDate = gapStr;
      recoverable = streak + 1 + runBefore;
    }
  }

  data.best = Math.max(data.best, streak, recoverable);
  const week: boolean[] = [];
  const w = new Date();
  w.setDate(w.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    week.push(data.dates.includes(toDateStr(w)));
    w.setDate(w.getDate() + 1);
  }
  try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* */ }
  return { current: streak, best: data.best, lastActive: today, week, gapDate, recoverableStreak: recoverable };
}

const Dashboard = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const s = await apiClient.getDashboardStats();
      try {
        if (s?.user_id) localStorage.setItem("user_id", s.user_id);
      } catch { /* */ }
      return s;
    },
    staleTime: 45_000, // matches server-side Redis TTL
    retry: false,
  });

  const isProUser = stats?.is_pro === true;

  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiClient.getLeaderboard(),
    staleTime: 60_000,
    refetchInterval: 3_600_000,
    retry: false,
  });

  const userName = stats?.user_name || localStorage.getItem("user_name") || "Student";
  const streakUserKey = stats?.user_id || localStorage.getItem("user_id") || "guest";
  const currentUserId = stats?.user_id ?? null;

  const [streakData, setStreakData] = useState(() => buildStreak(streakUserKey));

  // Re-build streak when the resolved user changes (e.g., after stats load or account switch)
  // so each user sees their own streak rather than a shared per-browser one.
  useEffect(() => {
    setStreakData(buildStreak(streakUserKey));
  }, [streakUserKey]);

  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, { id: number; name: string; topic_count: number; mcq_count: number }>();
    for (const s of stats?.subjects ?? []) {
      const existing = map.get(s.name);
      if (existing) {
        existing.topic_count += s.topic_count;
        existing.mcq_count += s.mcq_count;
      } else {
        map.set(s.name, { ...s });
      }
    }
    return Array.from(map.values());
  }, [stats?.subjects]);

  const totalSubjects = uniqueSubjects.length;

  const userTestsTaken = stats?.tests_taken ?? 0;
  const userMcqsAttempted = stats?.mcqs_attempted ?? 0;
  const userAccuracy = stats?.accuracy ?? 0;

  const subjectAttempted = stats?.subject_attempted ?? [];
  const maxAttempted = subjectAttempted.length ? Math.max(...subjectAttempted.map((s) => s.attempted), 1) : 1;

  /* ── XP & Level System (transparent, scaling) ──
     Level N requires N * 1000 XP to reach Level N+1.
     Cumulative XP to reach Level N = 500 * N * (N - 1).
     Level 1 → 0, L2 → 1k, L3 → 3k, L4 → 6k, L5 → 10k, L6 → 15k, L8 → 28k, L10 → 45k. */
  const correctMcqs = Math.round((userAccuracy / 100) * userMcqsAttempted);
  const xpFromCorrect = correctMcqs * 5;
  const xpFromAttempts = userMcqsAttempted * 2;
  const xpFromSessions = userTestsTaken * 50;
  const xpFromStreak = streakData.current * 20; // bonus for daily consistency
  const totalXp = xpFromCorrect + xpFromAttempts + xpFromSessions + xpFromStreak;

  const computeLevel = (xp: number) => Math.floor((1 + Math.sqrt(1 + xp / 125)) / 2);
  const xpAtLevelStart = (n: number) => 500 * n * (n - 1);
  const level = Math.max(1, computeLevel(totalXp));
  const xpThisLevelStart = xpAtLevelStart(level);
  const xpNextLevelStart = xpAtLevelStart(level + 1);
  const xpInLevel = totalXp - xpThisLevelStart;
  const xpForLevelSpan = xpNextLevelStart - xpThisLevelStart; // = level * 1000
  const xpToNext = Math.max(0, xpNextLevelStart - totalXp);
  const levelPct = Math.min(100, Math.round((xpInLevel / xpForLevelSpan) * 100));

  /* ── Reward milestones ── */
  const REWARDS: { level: number; label: string; icon: string; desc: string; isTrial?: boolean }[] = [
    { level: 3, label: "Consistency Badge", icon: "🥉", desc: "Earn a permanent profile badge" },
    { level: 5, label: "7-Day Pro Trial", icon: "🎁", desc: "Unlock all Pro features free for a week", isTrial: true },
    { level: 8, label: "Streak Saver", icon: "🛡️", desc: "Auto-protect your streak for 1 missed day" },
    { level: 10, label: "Elite Scholar", icon: "👑", desc: "Permanent crown on the leaderboard" },
  ];

  /* ── Server-backed rewards (source of truth) ── */
  const [rewards, setRewards] = useState<UserRewards | null>(null);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Server is authoritative for streak count once sync-streak has run.
  // Falls back to the locally-tracked value during first render.
  const displayedStreak = rewards?.streak_current ?? streakData.current;

  const refreshRewards = useCallback(async () => {
    try { const r = await apiClient.getMyRewards(); setRewards(r); } catch { /* */ }
  }, []);

  // Push the locally-tracked streak up so the server can include streak XP
  // in its level computation (rewards are validated server-side).
  useEffect(() => {
    let cancelled = false;
    apiClient.syncStreak(streakData.current, streakData.best)
      .then(r => { if (!cancelled) setRewards(r); })
      .catch(() => { if (!cancelled) refreshRewards(); });
    return () => { cancelled = true; };
  }, [streakData.current, streakData.best, refreshRewards]);

  const claimReward = useCallback(async (level: number) => {
    setClaimingLevel(level);
    setClaimError(null);
    try {
      const r = await apiClient.claimReward(level);
      setRewards(r);
      // Pro-trial just got granted server-side: refetch dashboard so is_pro flips
      if (level === 5) {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      }
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Couldn't claim reward");
    } finally {
      setClaimingLevel(null);
    }
  }, []);

  const useStreakSaver = useCallback(async () => {
    if (!streakData.gapDate) return;
    if (!rewards || rewards.streak_savers <= 0) return;
    try {
      const r = await apiClient.useStreakSaver();
      setRewards(r);
      // Inject the missed day client-side so the streak now spans it
      const filled = streakData.gapDate;
      setStreakData(buildStreak(streakUserKey, { extraDates: [filled] }));
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : "Couldn't use streak saver");
    }
  }, [streakData.gapDate, rewards, streakUserKey]);

  /* ── Daily XP history (persisted, real) ── */
  const today = new Date().toISOString().slice(0, 10);
  const [xpHistory, setXpHistory] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem("prepnest_xp_history") || "{}"); } catch { return {}; }
  });
  // Track daily baseline + latest XP. We store: { dateBaselines: { date: xp_at_first_load }, dateLatest: { date: xp_now } }
  const [xpDaily] = useState<{ baseline: Record<string, number>; latest: Record<string, number> }>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("prepnest_xp_daily") || "{}");
      return { baseline: parsed.baseline || {}, latest: parsed.latest || {} };
    } catch { return { baseline: {}, latest: {} }; }
  });
  useEffect(() => {
    if (!stats) return; // wait until real data
    const baseline = { ...xpDaily.baseline };
    const latest = { ...xpDaily.latest };
    if (baseline[today] === undefined) baseline[today] = totalXp;
    latest[today] = totalXp;
    // keep last 30 days
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    for (const k of Object.keys(baseline)) if (k < cutoffStr) delete baseline[k];
    for (const k of Object.keys(latest)) if (k < cutoffStr) delete latest[k];
    try { localStorage.setItem("prepnest_xp_daily", JSON.stringify({ baseline, latest })); } catch { /* */ }
    xpDaily.baseline = baseline; xpDaily.latest = latest;
    setXpHistory({ ...latest });
  }, [stats, totalXp]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Smart insights from real data ── */
  const xpToday = Math.max(0, totalXp - (xpDaily.baseline[today] ?? totalXp));
  const DAILY_XP_GOAL = 100;
  const dailyGoalPct = Math.min(100, Math.round((xpToday / DAILY_XP_GOAL) * 100));

  // 7-day XP gained: (today's latest) - (oldest baseline within last 7 days)
  const last7Dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last7Dates.push(d.toISOString().slice(0, 10));
  }
  const oldestBaseline = (() => {
    for (const d of last7Dates) {
      if (xpDaily.baseline[d] !== undefined) return xpDaily.baseline[d];
    }
    return totalXp;
  })();
  const xpLast7Days = Math.max(0, totalXp - oldestBaseline);
  const activeDaysThisWeek = streakData.week.filter(Boolean).length;
  const avgXpPerActiveDay = activeDaysThisWeek > 0 ? Math.round(xpLast7Days / activeDaysThisWeek) : 0;
  const etaDays = avgXpPerActiveDay > 0 ? Math.ceil(xpToNext / avgXpPerActiveDay) : null;

  // Accuracy trend signal — count subjects above/below 70%
  const strongSubjects = subjectAttempted.filter(s => s.attempted >= 5 && s.correct / s.attempted >= 0.7).length;
  const eligibleSubjects = subjectAttempted.filter(s => s.attempted >= 5).length;

  void xpHistory; // referenced for re-render trigger

  const aiSuggestions = useMemo(() => {
    const tips: { title: string; desc: string; icon: typeof Target; to?: string }[] = [];
    if (userTestsTaken === 0) {
      tips.push({ title: "Take Your First Test", desc: "Jump into a mock test to benchmark your starting level.", icon: Award, to: "/mock-test" });
    }
    if (userMcqsAttempted === 0) {
      tips.push({ title: "Start Practicing", desc: "Solve your first set of MCQs to begin tracking progress.", icon: Target, to: "/practice" });
    }
    if (userAccuracy > 0 && userAccuracy < 50) {
      tips.push({ title: "Review Weak Areas", desc: `Your accuracy is ${userAccuracy}% — revisit topics you got wrong and try again.`, icon: AlertTriangle });
    }
    if (userAccuracy >= 50 && userAccuracy < 80) {
      tips.push({ title: "Push Past 80%", desc: `You're at ${userAccuracy}% accuracy — keep practicing to break through.`, icon: TrendingUp, to: "/practice" });
    }
    if (userAccuracy >= 80) {
      tips.push({ title: "You're Crushing It!", desc: `${userAccuracy}% accuracy — try harder mock tests to challenge yourself.`, icon: Award, to: "/mock-test" });
    }
    if (displayedStreak === 0) {
      tips.push({ title: "Build a Streak", desc: "Start a daily habit — even 10 MCQs a day makes a difference.", icon: Flame, to: "/practice" });
    } else if (displayedStreak >= 3) {
      tips.push({ title: `${displayedStreak}-Day Streak! 🔥`, desc: "Amazing consistency! Keep going to unlock your full potential.", icon: Flame });
    }
    const weakSubjects = subjectAttempted.filter((s) => s.attempted > 0 && s.correct / s.attempted < 0.5);
    if (weakSubjects.length > 0) {
      tips.push({ title: `Focus on ${weakSubjects[0].subject_name}`, desc: `Your accuracy in ${weakSubjects[0].subject_name} is low — targeted practice will help.`, icon: Brain, to: "/practice" });
    }
    const subjectNames = subjectAttempted.map((s) => s.subject_name);
    const untried = uniqueSubjects.filter((s) => !subjectNames.includes(s.name));
    if (untried.length > 0 && userMcqsAttempted > 0) {
      tips.push({ title: `Explore ${untried[0].name}`, desc: `You haven't attempted any MCQs in ${untried[0].name} yet.`, icon: BookOpen, to: "/practice" });
    }
    if (tips.length === 0) {
      tips.push({ title: "Ask AI Tutor", desc: "Get instant explanations for any topic or concept.", icon: Brain, to: "/ai-tutor" });
    }
    return tips.slice(0, 3);
  }, [userAccuracy, userTestsTaken, userMcqsAttempted, displayedStreak, subjectAttempted, uniqueSubjects]);

  const greetingByTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <Navbar />

      {/* Page background — soft tricolor gradient matching MockTestPage */}
      <div
        className="relative min-h-screen pt-20 pb-16 page-bg-gradient"
        style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #f0fdfa 100%)" }}
      >

        {/* Decorative blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)" }} />
          <div className="absolute top-1/2 -right-48 w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }} />
          <div className="absolute -bottom-24 left-1/3 w-[350px] h-[350px] rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
        </div>

        {loading ? (
          <div className="container relative z-10 mx-auto px-4 max-w-6xl">
            {/* Hero banner skeleton */}
            <div className="mb-8 h-40 animate-pulse rounded-3xl bg-gradient-to-r from-indigo-200 via-purple-200 to-sky-200 opacity-60" />
            {/* Stat cards skeleton row */}
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white/70 p-5 shadow">
                  <div className="mb-3 h-3 w-12 rounded bg-slate-200" />
                  <div className="h-7 w-20 rounded bg-slate-200" />
                </div>
              ))}
            </div>
            {/* Content area skeletons */}
            <div className="grid gap-6 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-white/70 p-6 shadow">
                  <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="h-3 w-full rounded bg-slate-200" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="container relative z-10 mx-auto px-4 max-w-6xl">

            {/* ── Hero Banner ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-8 overflow-hidden rounded-3xl p-8 shadow-2xl"
              style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0ea5e9 100%)" }}
            >
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 translate-x-16 -translate-y-16"
                style={{ background: "radial-gradient(circle, white, transparent)" }} />
              <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-10 translate-y-12"
                style={{ background: "radial-gradient(circle, #a5f3fc, transparent)" }} />

              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-bold text-white/90">
                    <Flame className="h-3.5 w-3.5 text-amber-300" />
                    {totalSubjects} subjects loaded
                  </span>
                  {rewards?.consistency_badge && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-400/20 px-3 py-1.5 text-[11px] font-black text-amber-100" title="Consistency Badge — Lvl 3 reward">
                      🥉 Consistency
                    </span>
                  )}
                  {rewards?.is_elite && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-300/60 bg-yellow-400/20 px-3 py-1.5 text-[11px] font-black text-yellow-100" title="Elite Scholar — Lvl 10 reward">
                      👑 Elite Scholar
                    </span>
                  )}
                  {rewards?.pro_trial_expires_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-400/20 px-3 py-1.5 text-[11px] font-black text-emerald-100">
                      🎁 Pro Trial · {Math.max(0, Math.ceil((new Date(rewards.pro_trial_expires_at).getTime() - Date.now()) / 86400000))}d left
                    </span>
                  )}
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white mt-1 mb-1.5"
                  style={{ textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}>
                  {greetingByTime}, {userName}!
                </h1>
                <p className="text-sm font-medium text-indigo-200">
                  Here's your preparation overview for today.
                </p>
              </div>
            </motion.div>

            {/* ── Stat Cards ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {[
                {
                  label: "Accuracy",
                  value: `${userAccuracy}%`,
                  icon: CheckCircle,
                  gradient: "linear-gradient(135deg, #059669, #0d9488)",
                  bg: "#f0fdf4",
                  border: "#a7f3d0",
                  accent: "#047857",
                  lightBg: "#dcfce7",
                  bar: "from-emerald-500 to-teal-400",
                },
                {
                  label: "Tests Taken",
                  value: String(userTestsTaken),
                  icon: Award,
                  gradient: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  bg: "#eef2ff",
                  border: "#c7d2fe",
                  accent: "#4338ca",
                  lightBg: "#e0e7ff",
                  bar: "from-indigo-500 to-violet-500",
                },
                {
                  label: "MCQs Attempted",
                  value: String(userMcqsAttempted),
                  icon: TrendingUp,
                  gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
                  bg: "#fffbeb",
                  border: "#fde68a",
                  accent: "#92400e",
                  lightBg: "#fef3c7",
                  bar: "from-amber-500 to-orange-400",
                },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07 }}
                  className="dashboard-stat-card group relative overflow-hidden rounded-2xl border-2 p-5 shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                  style={{ backgroundColor: stat.bg, borderColor: stat.border }}
                >
                  {/* Top gradient bar */}
                  <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${stat.bar}`} />

                  <div className="mt-1 mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm"
                      style={{ background: stat.gradient }}>
                      <stat.icon className="h-5 w-5 text-white" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dashboard-stat-accent"
                      style={{ color: stat.accent }} />
                  </div>
                  <div className="text-3xl font-black text-slate-800 dashboard-stat-accent" style={{ color: stat.accent }}>
                    {stat.value}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            {/* ── Main Grid ── */}
            <div className="grid gap-6 lg:grid-cols-3">

              {/* ── Left Column (2/3) ── */}
              <div className="space-y-6 lg:col-span-2">

                {/* Bar Chart — Attempts by Subject */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="relative overflow-hidden rounded-3xl border border-white/80 bg-white shadow-lg shadow-indigo-100/30"
                >
                  {/* Gradient header */}
                  <div className="relative px-6 py-5 overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%)" }}>
                    <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-20"
                      style={{ background: "radial-gradient(circle, white, transparent 70%)" }} />
                    <div className="relative flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2.5 text-base font-black text-white">
                        <Trophy className="h-5 w-5" />
                        Reward Quest
                      </h2>
                      <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-black text-white">
                        LEVEL {level}
                      </span>
                    </div>
                  </div>

                  {(() => {
                    // Big ring shows LEVEL progress (XP)
                    const r = 44;
                    const c = 2 * Math.PI * r;
                    const ringOffset = c - (levelPct / 100) * c;

                    const trialReward = REWARDS.find(r => r.isTrial)!;
                    const trialUnlocked = level >= trialReward.level;

                    return (
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          {/* Level XP ring */}
                          <div className="relative shrink-0">
                            <svg width="120" height="120" className="-rotate-90">
                              <defs>
                                <linearGradient id="xpRingGrad" x1="0" y1="0" x2="1" y2="1">
                                  <stop offset="0%" stopColor="#4f46e5" />
                                  <stop offset="50%" stopColor="#7c3aed" />
                                  <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                              </defs>
                              <circle cx="60" cy="60" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
                              <motion.circle
                                cx="60" cy="60" r={r} fill="none" stroke="url(#xpRingGrad)" strokeWidth="10" strokeLinecap="round"
                                strokeDasharray={c}
                                initial={{ strokeDashoffset: c }}
                                animate={{ strokeDashoffset: ringOffset }}
                                transition={{ duration: 1.1, ease: "easeOut", delay: 0.3 }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Level</span>
                              <span className="text-3xl font-black leading-none" style={{ background: "linear-gradient(135deg, #4f46e5, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{level}</span>
                              <span className="text-[10px] font-bold text-slate-400 mt-0.5">{levelPct}%</span>
                            </div>
                          </div>

                          {/* XP details */}
                          <div className="flex-1 w-full">
                            <div className="flex items-baseline justify-between mb-1.5">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">XP to Level {level + 1}</span>
                              <span className="text-xs font-black text-indigo-600">{xpInLevel.toLocaleString()} / {xpForLevelSpan.toLocaleString()}</span>
                            </div>
                            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899)" }}
                                initial={{ width: 0 }}
                                animate={{ width: `${levelPct}%` }}
                                transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                              />
                            </div>
                            <p className="mt-2 text-[11px] text-slate-500">
                              <span className="font-black text-indigo-700">{xpToNext.toLocaleString()} XP</span> to reach <span className="font-bold text-indigo-600">Level {level + 1}</span>
                              {' • '}<span className="font-bold text-slate-600">{totalXp.toLocaleString()} total XP</span>
                            </p>

                            {/* How XP is earned — transparent breakdown from real activity */}
                            <div className="mt-3 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 p-2.5">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">How you earned {totalXp.toLocaleString()} XP</span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5 text-center">
                                <div title={`${correctMcqs} correct × 5 XP`}>
                                  <div className="text-xs font-black text-emerald-700">+{xpFromCorrect}</div>
                                  <div className="text-[10px] font-semibold text-slate-500 leading-tight">{correctMcqs} correct<br/><span className="text-slate-400">×5</span></div>
                                </div>
                                <div title={`${userMcqsAttempted} attempted × 2 XP`}>
                                  <div className="text-xs font-black text-blue-700">+{xpFromAttempts}</div>
                                  <div className="text-[10px] font-semibold text-slate-500 leading-tight">{userMcqsAttempted} attempts<br/><span className="text-slate-400">×2</span></div>
                                </div>
                                <div title={`${userTestsTaken} sessions × 50 XP`}>
                                  <div className="text-xs font-black text-violet-700">+{xpFromSessions}</div>
                                  <div className="text-[10px] font-semibold text-slate-500 leading-tight">{userTestsTaken} sessions<br/><span className="text-slate-400">×50</span></div>
                                </div>
                                <div title={`${displayedStreak}-day streak × 20 XP`}>
                                  <div className="text-xs font-black text-amber-700">+{xpFromStreak}</div>
                                  <div className="text-[10px] font-semibold text-slate-500 leading-tight">{displayedStreak}-day streak<br/><span className="text-slate-400">×20</span></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ── Rewards Rail ── */}
                        <div className="mt-5 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm" style={{ background: "linear-gradient(135deg, #f59e0b, #f43f5e)" }}>
                                <Gift className="h-3.5 w-3.5 text-white" />
                              </div>
                              <span className="text-[12px] font-black text-slate-800">Level Rewards</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500">
                              {(rewards?.claimed ?? []).length} / {REWARDS.length} claimed
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {REWARDS.map((rw) => {
                              const unlocked = level >= rw.level;
                              const claimed = (rewards?.claimed ?? []).includes(rw.level);
                              const claiming = claimingLevel === rw.level;
                              return (
                                <div
                                  key={rw.level}
                                  className={`relative rounded-xl border p-2.5 text-center transition-all ${claimed ? "border-emerald-300 bg-white shadow-sm" : unlocked ? "border-amber-300 bg-white shadow-sm" : "border-slate-200 bg-white/50 opacity-70"}`}
                                  title={rw.desc}
                                >
                                  <div className="text-lg leading-none mb-1">{rw.icon}</div>
                                  <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Lvl {rw.level}</div>
                                  <div className={`mt-0.5 text-[10px] font-black leading-tight ${unlocked ? "text-slate-800" : "text-slate-400"}`}>{rw.label}</div>
                                  {claimed ? (
                                    <div className="absolute top-1.5 right-1.5">
                                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                                    </div>
                                  ) : !unlocked ? (
                                    <div className="absolute top-1.5 right-1.5">
                                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                                    </div>
                                  ) : null}
                                  {unlocked && !claimed && rw.level !== 5 && (
                                    <button
                                      onClick={() => claimReward(rw.level)}
                                      disabled={claiming}
                                      className="mt-1.5 w-full rounded-md px-2 py-0.5 text-[9px] font-black text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60"
                                      style={{ background: "linear-gradient(135deg, #f59e0b, #f43f5e)" }}
                                    >
                                      {claiming ? "…" : "Claim"}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {claimError && (
                            <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[10px] font-semibold text-rose-700">
                              {claimError}
                            </div>
                          )}

                          {/* Pro Trial CTA — the headline reward */}
                          {(() => {
                            const proClaimed = (rewards?.claimed ?? []).includes(5);
                            const trialActive = !!rewards?.pro_trial_expires_at;
                            const daysLeft = trialActive
                              ? Math.max(0, Math.ceil((new Date(rewards!.pro_trial_expires_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                              : 0;
                            // Hide CTA only when user is permanently Pro (admin-granted) and never claimed trial
                            if (isProUser && !proClaimed && !trialActive) return null;
                            return (
                              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border-2 border-dashed p-3"
                                style={{ borderColor: trialUnlocked ? "#10b981" : "#fcd34d", background: trialUnlocked ? "linear-gradient(135deg, #ecfdf5, #d1fae5)" : "linear-gradient(135deg, #fffbeb, #fef3c7)" }}>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="text-2xl shrink-0">{trialUnlocked ? "🎉" : "🎯"}</div>
                                  <div className="min-w-0">
                                    <div className="text-[12px] font-black text-slate-800 truncate">
                                      {trialActive
                                        ? `Pro Trial Active · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
                                        : trialUnlocked
                                          ? (proClaimed ? "7-Day Pro Trial Claimed" : "7-Day Pro Trial Unlocked!")
                                          : `Reach Level ${trialReward.level} for free Pro week`}
                                    </div>
                                    <div className="text-[10px] font-semibold text-slate-500 truncate">
                                      {trialActive
                                        ? "Enjoy unlimited mock tests, full leaderboard & more"
                                        : trialUnlocked
                                          ? (proClaimed ? "Trial used. Upgrade for permanent access." : "Click claim to activate — no card needed")
                                          : `${Math.max(0, xpAtLevelStart(trialReward.level) - totalXp).toLocaleString()} XP to go`}
                                    </div>
                                  </div>
                                </div>
                                {trialUnlocked && !proClaimed ? (
                                  <button onClick={() => claimReward(5)}
                                    disabled={claimingLevel === 5}
                                    className="shrink-0 rounded-full px-4 py-1.5 text-[11px] font-black text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60"
                                    style={{ background: "linear-gradient(135deg, #10b981, #14b8a6)" }}>
                                    {claimingLevel === 5 ? "Claiming…" : "Claim Now"}
                                  </button>
                                ) : !trialUnlocked ? (
                                  <div className="shrink-0 text-right">
                                    <div className="text-[10px] font-bold text-amber-700">Lvl {level} → {trialReward.level}</div>
                                    <div className="mt-1 h-1.5 w-20 rounded-full bg-amber-100 overflow-hidden">
                                      <div className="h-full rounded-full"
                                        style={{ width: `${Math.min(100, Math.round((totalXp / xpAtLevelStart(trialReward.level)) * 100))}%`, background: "linear-gradient(90deg, #f59e0b, #f43f5e)" }} />
                                    </div>
                                  </div>
                                ) : (
                                  <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })()}
                </motion.div>

                {/* ── Progress Tracker — subject-focused preparation tracking ── */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-3xl border border-white/80 bg-white p-6 shadow-lg shadow-violet-100/30"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="flex items-center gap-2.5 text-base font-black text-slate-800">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm"
                        style={{ background: "linear-gradient(135deg, #06b6d4, #3b82f6)" }}>
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      Subject Progress
                    </h2>
                    <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live · Real data
                    </span>
                  </div>

                  {(() => {
                    // Build per-subject roster from ALL DB subjects, joined with attempts
                    const attemptMap = new Map(subjectAttempted.map(s => [s.subject_name, s]));
                    const roster = uniqueSubjects.map(sub => {
                      const a = attemptMap.get(sub.name);
                      const attempted = a?.attempted ?? 0;
                      const correct = a?.correct ?? 0;
                      const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
                      const enough = attempted >= 5;
                      const tier = attempted === 0
                        ? "untouched"
                        : !enough ? "starting"
                        : acc >= 80 ? "mastered"
                        : acc >= 60 ? "building"
                        : "review";
                      return { name: sub.name, mcq_count: sub.mcq_count, topic_count: sub.topic_count, attempted, correct, acc, enough, tier };
                    });

                    const started = roster.filter(r => r.attempted > 0).length;
                    const mastered = roster.filter(r => r.tier === "mastered").length;
                    const needsReview = roster.filter(r => r.tier === "review").length;
                    const totalSolved = roster.reduce((s, r) => s + r.correct, 0);
                    const totalAttempted = roster.reduce((s, r) => s + r.attempted, 0);
                    const overallAcc = totalAttempted > 0 ? Math.round((totalSolved / totalAttempted) * 100) : 0;
                    const totalSubj = roster.length || 1;
                    const coveragePct = Math.round((started / totalSubj) * 100);

                    // Pick "next focus" — weakest started subject; else first untouched with content
                    const focusSubject =
                      roster.filter(r => r.tier === "review").sort((a, b) => a.acc - b.acc)[0] ||
                      roster.filter(r => r.tier === "building").sort((a, b) => a.acc - b.acc)[0] ||
                      roster.filter(r => r.attempted === 0 && r.mcq_count > 0)[0] ||
                      null;

                    const tierCfg: Record<string, { c: string; bg: string; lbl: string; action: string; emoji: string }> = {
                      untouched: { c: "#94a3b8", bg: "#f1f5f9", lbl: "Not started", action: "Begin here", emoji: "📘" },
                      starting:  { c: "#6366f1", bg: "#eef2ff", lbl: "Just started", action: "Solve 5+ to gauge", emoji: "🌱" },
                      mastered:  { c: "#10b981", bg: "#ecfdf5", lbl: "Mastered", action: "Looking solid", emoji: "🏆" },
                      building:  { c: "#f59e0b", bg: "#fffbeb", lbl: "Building", action: "Push to 80%", emoji: "📈" },
                      review:    { c: "#f43f5e", bg: "#fff1f2", lbl: "Needs review", action: "Revise basics", emoji: "🎯" },
                    };

                    const sortedRoster = [...roster].sort((a, b) => {
                      // Order: review → building → starting → mastered → untouched
                      const order: Record<string, number> = { review: 0, building: 1, starting: 2, mastered: 3, untouched: 4 };
                      if (order[a.tier] !== order[b.tier]) return order[a.tier] - order[b.tier];
                      return b.attempted - a.attempted;
                    });

                    return (
                      <>
                        {/* Top stat strip — subject-focused */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                          <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-violet-50/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                              <span className="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Coverage</span>
                            </div>
                            <div className="text-xl font-black text-slate-800">{started}<span className="text-sm font-bold text-slate-400">/{totalSubj}</span></div>
                            <div className="text-[10px] font-bold text-slate-500">subjects started</div>
                            <div className="mt-1.5 h-1 w-full rounded-full bg-white/60 overflow-hidden">
                              <motion.div className="h-full rounded-full"
                                style={{ background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
                                initial={{ width: 0 }} animate={{ width: `${coveragePct}%` }} transition={{ duration: 0.8 }} />
                            </div>
                            <div className="mt-1 text-[9px] font-bold text-indigo-700">{coveragePct}% syllabus touched</div>
                          </div>

                          <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <Crown className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">Mastered</span>
                            </div>
                            <div className="text-xl font-black text-slate-800">{mastered}<span className="text-sm font-bold text-slate-400">/{totalSubj}</span></div>
                            <div className="text-[10px] font-bold text-slate-500">at 80%+ accuracy</div>
                            <div className="mt-1 text-[9px] font-bold text-emerald-700">
                              {mastered === 0 ? "First mastery soon!" : `${Math.round((mastered / totalSubj) * 100)}% of syllabus`}
                            </div>
                          </div>

                          <div className="rounded-2xl border-2 p-3"
                            style={{ borderColor: overallAcc >= 70 ? "#a7f3d0" : overallAcc >= 50 ? "#fde68a" : "#fecaca", background: overallAcc >= 70 ? "linear-gradient(135deg, #ecfdf5, #f0fdfa)" : overallAcc >= 50 ? "linear-gradient(135deg, #fffbeb, #fff7ed)" : "linear-gradient(135deg, #fef2f2, #fff1f2)" }}>
                            <div className="flex items-center justify-between mb-1">
                              <Target className="h-3.5 w-3.5" style={{ color: overallAcc >= 70 ? "#059669" : overallAcc >= 50 ? "#d97706" : "#dc2626" }} />
                              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: overallAcc >= 70 ? "#047857" : overallAcc >= 50 ? "#92400e" : "#991b1b" }}>Accuracy</span>
                            </div>
                            <div className="text-xl font-black text-slate-800">{totalAttempted > 0 ? `${overallAcc}%` : "—"}</div>
                            <div className="text-[10px] font-bold text-slate-500">overall correct</div>
                            <div className="mt-1 text-[9px] font-bold" style={{ color: overallAcc >= 70 ? "#047857" : overallAcc >= 50 ? "#92400e" : "#991b1b" }}>
                              {totalSolved}/{totalAttempted} MCQs
                            </div>
                          </div>

                          <div className="rounded-2xl border-2 p-3"
                            style={{ borderColor: needsReview > 0 ? "#fecdd3" : "#a7f3d0", background: needsReview > 0 ? "linear-gradient(135deg, #fef2f2, #fff1f2)" : "linear-gradient(135deg, #ecfdf5, #f0fdfa)" }}>
                            <div className="flex items-center justify-between mb-1">
                              <AlertTriangle className="h-3.5 w-3.5" style={{ color: needsReview > 0 ? "#dc2626" : "#059669" }} />
                              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: needsReview > 0 ? "#991b1b" : "#047857" }}>Focus</span>
                            </div>
                            <div className="text-xl font-black text-slate-800">{needsReview}</div>
                            <div className="text-[10px] font-bold text-slate-500">need{needsReview === 1 ? "s" : ""} review</div>
                            <div className="mt-1 text-[9px] font-bold truncate" style={{ color: needsReview > 0 ? "#991b1b" : "#047857" }}>
                              {needsReview > 0 ? "Below 60% accuracy" : "All studied subjects strong"}
                            </div>
                          </div>
                        </div>

                        {/* Tier legend */}
                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                          {(["mastered", "building", "review", "starting", "untouched"] as const).map(k => (
                            <span key={k} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                              style={{ background: tierCfg[k].bg, borderColor: tierCfg[k].c + "40", color: tierCfg[k].c }}>
                              {tierCfg[k].emoji} {tierCfg[k].lbl}
                            </span>
                          ))}
                        </div>

                        {/* Per-subject list — ALL subjects */}
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-3">
                          {roster.length === 0 ? (
                            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center">
                              <BookOpen className="mx-auto mb-2 h-6 w-6 text-indigo-500" />
                              <p className="text-xs font-semibold text-slate-600">No subjects loaded yet — admin must seed content</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {sortedRoster.map((s) => {
                                const cfg = tierCfg[s.tier];
                                const fillPct = s.attempted === 0 ? 0
                                  : s.enough ? s.acc
                                  : Math.min(100, (s.attempted / 5) * 100);
                                return (
                                  <div key={s.name}
                                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 hover:border-slate-200 hover:shadow-sm transition-all">
                                    <div className="text-lg shrink-0">{cfg.emoji}</div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-baseline justify-between gap-2 mb-1">
                                        <span className="text-[12px] font-black text-slate-800 truncate">{s.name}</span>
                                        <span className="text-[11px] font-black shrink-0" style={{ color: cfg.c }}>
                                          {s.attempted === 0 ? "—" : s.enough ? `${s.acc}%` : `${s.attempted}/5`}
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                        <motion.div className="h-full rounded-full"
                                          style={{ background: cfg.c }}
                                          initial={{ width: 0 }}
                                          animate={{ width: `${fillPct}%` }}
                                          transition={{ duration: 0.7 }} />
                                      </div>
                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-semibold text-slate-500 truncate">
                                          {s.attempted === 0
                                            ? `${s.topic_count} topics available`
                                            : s.enough
                                              ? `${s.correct}/${s.attempted} correct`
                                              : `${s.correct}/${s.attempted} correct · ${5 - s.attempted} more for accuracy`}
                                        </span>
                                        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: cfg.c }}>
                                          {cfg.action}
                                        </span>
                                      </div>
                                    </div>
                                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                                      style={{ background: cfg.bg, color: cfg.c }}>
                                      {cfg.lbl}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Smart focus nudge — subject-targeted */}
                        {focusSubject ? (
                          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border-2 p-3"
                            style={{ borderColor: tierCfg[focusSubject.tier].c + "60", background: tierCfg[focusSubject.tier].bg }}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl shadow-sm bg-white">
                                {tierCfg[focusSubject.tier].emoji}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11px] font-black uppercase tracking-wider mb-0.5" style={{ color: tierCfg[focusSubject.tier].c }}>
                                  Focus Next
                                </div>
                                <div className="text-[13px] font-black text-slate-800 truncate">
                                  {focusSubject.name}
                                </div>
                                <div className="text-[10px] font-semibold text-slate-600 truncate">
                                  {focusSubject.attempted === 0
                                    ? `Untouched · jump in to start practicing`
                                    : focusSubject.enough
                                      ? `Currently at ${focusSubject.acc}% — aim for 80%+`
                                      : `Only ${focusSubject.attempted} attempts — solve ${5 - focusSubject.attempted}+ more`}
                                </div>
                              </div>
                            </div>
                            <Link to="/practice"
                              className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-black text-white shadow-md transition-transform hover:scale-105"
                              style={{ background: `linear-gradient(135deg, ${tierCfg[focusSubject.tier].c}, ${tierCfg[focusSubject.tier].c}dd)` }}>
                              Practice <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          </div>
                        ) : roster.length > 0 && started === totalSubj && needsReview === 0 ? (
                          <div className="mt-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-3 text-center">
                            <div className="text-2xl mb-1">🎉</div>
                            <div className="text-[12px] font-black text-emerald-800">All subjects on track!</div>
                            <div className="text-[10px] font-semibold text-emerald-700">Keep practicing to push every subject above 80%</div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </motion.div>

                {/* Needs Attention */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-3xl border border-white/80 bg-white p-6 shadow-lg shadow-amber-100/30"
                >
                  <h2 className="mb-5 flex items-center gap-2.5 text-base font-black text-slate-800">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm"
                      style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                      <AlertTriangle className="h-4 w-4 text-white" />
                    </div>
                    Needs Attention
                  </h2>
                  <div className="space-y-3">
                    {(() => {
                      const attemptMap = new Map(subjectAttempted.map(s => [s.subject_name, s]));
                      const weak = uniqueSubjects
                        .map(sub => {
                          const a = attemptMap.get(sub.name);
                          const attempted = a?.attempted ?? 0;
                          const correct = a?.correct ?? 0;
                          const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
                          return { ...sub, attempted, acc };
                        })
                        .filter(s => s.attempted >= 5 && s.acc < 60)
                        .sort((a, b) => a.acc - b.acc)
                        .slice(0, 2);
                      if (weak.length === 0) {
                        return (
                          <div className="flex flex-col items-center gap-2 py-6">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                              style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                              <CheckCircle className="h-5 w-5 text-emerald-500" />
                            </div>
                            <p className="text-sm font-semibold text-emerald-600">No weak subjects detected — keep it up!</p>
                          </div>
                        );
                      }
                      return weak.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                          style={{ background: "linear-gradient(135deg, #fffbeb, #fff7ed)", borderColor: "#fde68a" }}
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-800">{s.name}</div>
                            <div className="mt-0.5 text-xs font-medium text-slate-500">{s.attempted} attempts so far</div>
                          </div>
                          <span className="shrink-0 rounded-full border px-3 py-1 text-xs font-black"
                            style={{ background: "#fff1f2", borderColor: "#fecdd3", color: "#be123c" }}>
                            {s.acc}% acc
                          </span>
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              </div>

              {/* ── Right Column (1/3) ── */}
              <div className="space-y-5">

                {/* Daily Streak — visible to all users */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="overflow-hidden rounded-3xl border border-white/80 bg-white p-5 shadow-lg shadow-orange-100/40"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-black text-slate-800">
                      <span className="text-xl leading-none">🔥</span>
                      Daily Streak
                    </h2>
                    <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-black"
                      style={{ background: "#fff7ed", borderColor: "#fed7aa", color: "#c2410c" }}>
                      Best: {streakData.best}d
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black" style={{ color: "#ea580c" }}>{displayedStreak}</span>
                    <span className="text-sm font-semibold text-slate-500 ml-1">
                      day{displayedStreak !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-3">
                    {displayedStreak > 0
                      ? "🚀 Keep your streak alive! Miss a day and it resets."
                      : "Start solving MCQs to build your streak!"}
                  </p>

                  {/* Streak Saver — gap recovery */}
                  {streakData.gapDate && (rewards?.streak_savers ?? 0) > 0 && (
                    <div className="mb-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">🛡️</span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-black text-amber-800 truncate">You missed a day!</div>
                            <div className="text-[10px] font-semibold text-amber-700 truncate">
                              Use 1 saver to recover {streakData.recoverableStreak}-day streak
                            </div>
                          </div>
                        </div>
                        <button onClick={useStreakSaver}
                          className="shrink-0 rounded-full px-3 py-1 text-[10px] font-black text-white shadow-sm transition-transform hover:scale-105"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #f43f5e)" }}>
                          Use ({rewards?.streak_savers})
                        </button>
                      </div>
                    </div>
                  )}
                  {streakData.gapDate && (rewards?.streak_savers ?? 0) === 0 && (
                    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-[10px] font-semibold text-slate-500">
                      💡 Reach <span className="font-black text-slate-700">Level 8</span> to earn a Streak Saver and protect missed days
                    </div>
                  )}
                  {!streakData.gapDate && (rewards?.streak_savers ?? 0) > 0 && (
                    <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-700">
                      🛡️ <span className="font-black">{rewards?.streak_savers}</span> Streak Saver{(rewards?.streak_savers ?? 0) > 1 ? "s" : ""} ready to protect your streak
                    </div>
                  )}

                  {/* Weekly bar (real last 7 days) */}
                  <div className="flex gap-1.5 mb-1">
                    {streakData.week.map((active, i) => (
                      <div key={i} className="h-6 flex-1 rounded-lg"
                        style={{
                          background: active
                            ? "linear-gradient(to top, #ea580c, #fbbf24)"
                            : "#f1f5f9",
                          boxShadow: active ? "0 2px 6px rgba(234,88,12,0.25)" : undefined,
                        }} />
                    ))}
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last 7 days</p>
                </motion.div>

                {/* Smart Suggestions */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-lg shadow-indigo-100/30"
                >
                  <div className="px-5 py-4"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed, #0ea5e9)" }}>
                    <h2 className="flex items-center gap-2 text-sm font-black text-white">
                      <Brain className="h-4 w-4" /> Smart Suggestions
                    </h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {aiSuggestions.map((s, i) => (
                      <Link
                        key={i}
                        to={s.to ?? "/practice"}
                        className="flex items-start gap-3 rounded-2xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                        style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", borderColor: "#c7d2fe" }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm"
                          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                          <s.icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-800">{s.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-slate-500">{s.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </motion.div>

                {/* Leaderboard */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="overflow-hidden rounded-3xl border border-white/80 bg-white shadow-lg shadow-amber-100/30"
                >
                  <div className="px-5 py-4"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #f97316, #ef4444)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-sm font-black text-white">
                        <Trophy className="h-4 w-4" /> Top Students Leaderboard
                      </h2>
                      {leaderboard?.period_label && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/95"
                          style={{ background: "rgba(255,255,255,0.18)" }}
                          title="Resets at the start of every month"
                        >
                          {leaderboard.period_label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {leaderboard?.previous_winner && (
                      <div
                        className="mb-3 flex items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 px-3 py-2.5"
                        title={`Last month's #1: ${leaderboard.previous_winner.user_name}`}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none">👑</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                            {leaderboard.previous_winner.month_label} champion
                          </div>
                          <div className="truncate text-sm font-bold text-slate-700">
                            {leaderboard.previous_winner.user_name}
                          </div>
                        </div>
                        <div
                          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black"
                          style={{ background: "#fef3c7", color: "#92400e" }}
                        >
                          {leaderboard.previous_winner.mcqs_solved} MCQs
                        </div>
                      </div>
                    )}
                    {!leaderboard || leaderboard.entries.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-8">
                        <Trophy className="h-8 w-8 text-amber-300" />
                        <p className="text-sm text-slate-400">No leaderboard data yet. Take a mock test!</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.entries.map((entry) => {
                          const isFirst = entry.rank === 1;
                          const isSecond = entry.rank === 2;
                          const isThird = entry.rank === 3;
                          const isTop3 = isFirst || isSecond || isThird;
                          const isCurrentUser = currentUserId !== null && entry.user_id === currentUserId;
                          const rankIcon = isFirst ? "🥇" : isSecond ? "🥈" : isThird ? "🥉" : null;

                          const cardStyle = isCurrentUser && !isTop3
                            ? { background: "linear-gradient(135deg, #eef2ff, #f5f3ff)", border: "2px solid #c7d2fe" }
                            : isFirst
                            ? { background: "linear-gradient(135deg, #fffbeb, #fef3c7)", border: "2px solid #fde68a" }
                            : isSecond
                            ? { background: "linear-gradient(135deg, #f8fafc, #f1f5f9)", border: "2px solid #e2e8f0" }
                            : isThird
                            ? { background: "linear-gradient(135deg, #fff7ed, #ffedd5)", border: "2px solid #fed7aa" }
                            : { background: "#f8fafc", border: "1px solid #e2e8f0" };

                          return (
                            <motion.div
                              key={entry.rank}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.45 + entry.rank * 0.04 }}
                              className="flex items-center gap-3 rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                              style={cardStyle}
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                                {rankIcon ? (
                                  <span className="text-xl leading-none">{rankIcon}</span>
                                ) : (
                                  <span className="text-xs font-black text-slate-400">#{entry.rank}</span>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`flex items-center gap-1.5 text-sm font-bold ${
                                  isCurrentUser ? "text-indigo-700" : isFirst ? "text-amber-700" : "text-slate-700"
                                }`}>
                                  <span className="truncate">{entry.user_name}</span>
                                  {isCurrentUser && (
                                    <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase"
                                      style={{ background: "#e0e7ff", color: "#4338ca" }}>
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {entry.tests_taken} test{entry.tests_taken !== 1 ? "s" : ""}
                                </div>
                              </div>
                              <div className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black"
                                style={
                                  isFirst
                                    ? { background: "#fef3c7", color: "#92400e" }
                                    : isTop3
                                    ? { background: "#eef2ff", color: "#4338ca" }
                                    : { background: "#f1f5f9", color: "#475569" }
                                }>
                                {entry.mcqs_solved} MCQs
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* Your rank — always shown when logged in */}
                    {currentUserId && leaderboard && (
                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Your rank
                        </p>
                        {leaderboard.my_entry && leaderboard.my_rank ? (
                          <div
                            className="flex items-center gap-3 rounded-2xl p-3"
                            style={{
                              background: "linear-gradient(135deg, #eef2ff, #f5f3ff)",
                              border: "2px solid #c7d2fe",
                            }}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                              #{leaderboard.my_rank}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-700">
                                <span className="truncate">{leaderboard.my_entry.user_name}</span>
                                <span
                                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase"
                                  style={{ background: "#e0e7ff", color: "#4338ca" }}
                                >
                                  You
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {leaderboard.my_entry.tests_taken} test
                                {leaderboard.my_entry.tests_taken !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <div
                              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-black"
                              style={{ background: "#eef2ff", color: "#4338ca" }}
                            >
                              {leaderboard.my_entry.mcqs_solved} MCQs
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-xs text-slate-500">
                            Unranked — solve MCQs or take a mock test to climb the board.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;
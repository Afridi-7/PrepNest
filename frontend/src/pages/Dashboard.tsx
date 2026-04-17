import { useEffect, useState, useMemo, useRef, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Award, AlertTriangle, Flame, BarChart3, ArrowUpRight, ChevronRight, Loader2, Trophy, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { apiClient, type DashboardStats, type LeaderboardResponse } from "@/services/api";

const SUBJECT_COLORS = [
  "from-blue-500 to-blue-500",
  "from-cyan-500 to-sky-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
];

/* ── Pro Feature Gate ── */
const ProFeatureLocked = ({ children, locked = true, label = "Unlock with Pro" }: { children: ReactNode; locked?: boolean; label?: string }) => {
  if (!locked) return <>{children}</>;
  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none select-none blur-[3px]">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/70 backdrop-blur-[2px] dark:bg-slate-900/70">
        <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
        <button className="mt-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 px-4 py-1.5 text-[11px] font-bold text-white shadow-lg shadow-blue-500/25 transition-transform hover:scale-105">
          Upgrade
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient
      .getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Pro user (safe placeholder — defaults false if field missing) ──
  const isProUser = (stats as any)?.is_pro === true;

  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);

  const fetchLeaderboard = useCallback(() => {
    apiClient.getLeaderboard().then(setLeaderboard).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isProUser) return;
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 3_600_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard, isProUser]);

  // ── Daily streak (localStorage-based, no extra API) ──
  const [streakData] = useState(() => {
    const key = "prepnest_streak";
    const toDS = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const today = toDS(new Date());
    let data: { dates: string[]; best: number } = { dates: [], best: 0 };
    try { const s = localStorage.getItem(key); if (s) data = JSON.parse(s); } catch { /* */ }
    if (!data.dates.includes(today)) data.dates.push(today);
    data.dates.sort();
    if (data.dates.length > 365) data.dates = data.dates.slice(-365);
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 366; i++) {
      if (data.dates.includes(toDS(d))) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    data.best = Math.max(data.best, streak);
    try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* */ }
    return { current: streak, best: data.best, lastActive: today };
  });

  const userName = stats?.user_name ?? "Student";

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
  const totalTopics = uniqueSubjects.reduce((sum, s) => sum + s.topic_count, 0);
  const totalMcqs = uniqueSubjects.reduce((sum, s) => sum + s.mcq_count, 0);
  const maxMcqs = uniqueSubjects.length ? Math.max(...uniqueSubjects.map((s) => s.mcq_count), 1) : 1;

  const progressData = uniqueSubjects.map((s, i) => ({
    subject: s.name,
    topics: s.topic_count,
    mcqs: s.mcq_count,
    progress: Math.min(100, Math.round((s.mcq_count / maxMcqs) * 100)),
    color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
  }));

  const greetingByTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-background pt-20 pb-16">

        {loading ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="container relative mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-7 shadow-xl shadow-blue-400/20"
            >

              <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm">
                    <Flame className="h-3.5 w-3.5 text-amber-300" /> {totalSubjects} subjects loaded
                  </p>
                  <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl">
                    {greetingByTime}, {userName}!
                  </h1>
                  <p className="mt-1.5 text-sm text-blue-200">Here&apos;s your preparation overview for today.</p>
                </div>
              </div>

            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              {[
                { label: "Subjects", value: String(totalSubjects), icon: Flame, bar: "from-blue-500 to-blue-600", bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-200", border: "border-blue-200 dark:border-blue-500/20" },
                { label: "Topics", value: String(totalTopics), icon: Target, bar: "from-cyan-500 to-pink-600", bg: "bg-cyan-100 dark:bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-200", border: "border-cyan-200 dark:border-cyan-500/20" },
                { label: "Total MCQs", value: String(totalMcqs), icon: TrendingUp, bar: "from-cyan-500 to-sky-600", bg: "bg-cyan-100 dark:bg-cyan-500/15", text: "text-cyan-700 dark:text-cyan-200", border: "border-cyan-200 dark:border-cyan-500/20" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className={`card-hover group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white p-5 shadow-lg transition-shadow duration-300 hover:shadow-xl dark:bg-slate-900 dark:shadow-black/20 ${stat.border}`}
                >
                  <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${stat.bar}`} />
                  <div className="mt-1 mb-3 flex items-center justify-between">
                    <div className={`${stat.bg} rounded-xl p-2.5`}>
                      <stat.icon className={`h-5 w-5 ${stat.text}`} />
                    </div>
                    <ArrowUpRight className={`h-4 w-4 ${stat.text} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} />
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{stat.value}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-400">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-200 dark:bg-blue-500/15">
                        <BarChart3 className="h-4 w-4 text-blue-700 dark:text-blue-200" />
                      </span>
                      Content by Subject
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Performance</span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">MCQs</span>
                    </div>
                  </div>
                  <div className="flex h-44 items-end gap-2 sm:gap-3">
                    {uniqueSubjects.slice(0, 7).map((s, i) => {
                      const pct = maxMcqs > 0 ? Math.round((s.mcq_count / maxMcqs) * 100) : 0;
                      const isMax = s.mcq_count === maxMcqs;
                      return (
                        <div key={s.id} className="group flex flex-1 cursor-pointer flex-col items-center gap-2" title={`${s.name}: ${s.mcq_count} MCQs, ${s.topic_count} topics`}>
                          <span className="text-[11px] font-semibold text-slate-500 transition-colors group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-300">{s.mcq_count}</span>
                          <motion.div
                            className={`w-full rounded-t-xl transition-colors ${isMax ? "bg-gradient-to-t from-blue-600 to-cyan-500 shadow-md shadow-blue-200 dark:shadow-blue-950/50" : "bg-gradient-to-t from-blue-200 to-blue-100 group-hover:from-blue-400 group-hover:to-blue-300 dark:from-blue-500/30 dark:to-blue-400/20 dark:group-hover:from-blue-500/50 dark:group-hover:to-blue-400/40"}`}
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(pct, 5)}%` }}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                          />
                          <span className={`text-[11px] font-semibold transition-colors ${isMax ? "text-blue-600 dark:text-blue-300" : "text-slate-400 group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-300"}`}>{s.name.slice(0, 4)}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border-2 border-blue-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-200 dark:bg-blue-500/15">
                        <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-200" />
                      </span>
                      Subject Progress
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {progressData.map((s, i) => (
                      <div key={s.subject} className="group">
                        <div className="mb-2 flex justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{s.subject}</span>
                            <span className="text-[10px] font-medium text-slate-400">{s.topics} topics · {s.mcqs} MCQs</span>
                          </div>
                          <span className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">{s.progress}%</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <motion.div
                            className={`h-full rounded-full bg-gradient-to-r ${s.color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${s.progress}%` }}
                            transition={{ delay: 0.4 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl border-2 border-amber-200 bg-white p-6 shadow-lg dark:border-amber-500/20 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <h2 className="mb-5 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-200 dark:bg-amber-500/15">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-200" />
                    </span>
                    Needs Attention
                  </h2>
                  <div className="space-y-3">
                    {uniqueSubjects
                      .filter((s) => s.mcq_count < 10)
                      .slice(0, 2)
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50/70 to-orange-50/50 p-3.5 dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/5">
                          <div>
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.name}</div>
                            <div className="mt-0.5 text-xs text-slate-400">{s.topic_count} topics</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-bold text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                            {s.mcq_count} MCQs
                          </span>
                        </div>
                      ))}
                    {uniqueSubjects.filter((s) => s.mcq_count < 10).length === 0 && (
                      <p className="py-4 text-center text-sm text-slate-400">All subjects have good MCQ coverage!</p>
                    )}
                  </div>
                </motion.div>
              </div>

              <div className="space-y-6">
                {/* ── Daily Streak ── */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="overflow-hidden rounded-2xl border border-orange-200/60 bg-white/90 p-5 shadow-lg backdrop-blur-sm dark:border-orange-500/20 dark:bg-slate-900/90 dark:shadow-black/20"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="text-xl leading-none"
                      >🔥</motion.span>
                      Daily Streak
                    </h2>
                    <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                      Best: {streakData.best}d
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-orange-600 dark:text-orange-400">{streakData.current}</span>
                    <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">day{streakData.current !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
                    {streakData.current > 0 ? "🚀 Keep your streak alive! Miss a day and it resets." : "Start solving MCQs to build your streak!"}
                  </p>
                  <ProFeatureLocked locked={!isProUser} label="Streak Insights · Pro">
                    <div className="mt-3 flex gap-1">
                      {[...Array(7)].map((_, i) => (
                        <div key={i} className={`h-5 flex-1 rounded ${i < streakData.current ? "bg-gradient-to-t from-orange-500 to-amber-400" : "bg-slate-100 dark:bg-slate-800"}`} />
                      ))}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">Weekly activity</p>
                  </ProFeatureLocked>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3.5">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Target className="h-4 w-4" /> Quick Actions
                    </h2>
                  </div>
                  <div className="space-y-2 p-4">
                    {[
                      { to: "/practice", icon: Target, label: "Take a Quiz", pill: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200", border: "hover:border-blue-300 dark:hover:border-blue-500/30" },
                      { to: "/ai-tutor", icon: Brain, label: "Ask AI Tutor", pill: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200", border: "hover:border-cyan-300 dark:hover:border-cyan-500/30" },
                      { to: "/usat", icon: BookOpen, label: "Open USAT Hub", pill: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-200", border: "hover:border-cyan-300 dark:hover:border-cyan-500/30" },
                      { to: "/admin", icon: Award, label: "Admin Content Studio", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200", border: "hover:border-emerald-300 dark:hover:border-emerald-500/30" },
                    ].map((a, i) => (
                      <Link
                        key={i}
                        to={a.to}
                        className={`group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 transition-all duration-200 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-800/70 dark:hover:bg-slate-800 ${a.border}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${a.pill}`}>
                          <a.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-100">{a.label}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500" />
                      </Link>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="overflow-hidden rounded-2xl border-2 border-cyan-200 bg-white shadow-lg dark:border-cyan-500/20 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <div className="bg-gradient-to-r from-cyan-500 to-pink-500 px-5 py-3.5">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Brain className="h-4 w-4" /> AI Suggestions
                    </h2>
                  </div>
                  <div className="space-y-3 p-4">
                    {[
                      { title: "Practice MCQs", desc: `You have ${totalMcqs} MCQs available - start a quiz!`, icon: Target },
                      { title: "Ask AI Tutor", desc: "Get instant help with any topic or question.", icon: Brain },
                    ].map((s, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-cyan-100 bg-gradient-to-r from-cyan-50/60 to-pink-50/40 p-3 dark:border-cyan-500/20 dark:from-cyan-500/10 dark:to-pink-500/5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-500/15">
                          <s.icon className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-200" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* ── Top Students Leaderboard (Pro-only) ── */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-lg dark:border-amber-500/25 dark:bg-slate-900 dark:shadow-black/20"
                >
                  <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 px-5 py-3.5">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Trophy className="h-4 w-4" /> Top Students Leaderboard
                    </h2>
                  </div>
                  <div className="p-4">
                    {isProUser ? (
                      !leaderboard || leaderboard.entries.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-400">No leaderboard data yet. Take a mock test!</p>
                      ) : (
                        <div className="space-y-2">
                          {leaderboard.entries.map((entry) => {
                            const isFirst = entry.rank === 1;
                            const isSecond = entry.rank === 2;
                            const isThird = entry.rank === 3;
                            const isTop3 = isFirst || isSecond || isThird;
                            const isCurrentUser = entry.user_name === userName;

                            const rankIcon = isFirst ? "🥇" : isSecond ? "🥈" : isThird ? "🥉" : null;

                            const ringClass = isCurrentUser && !isTop3
                              ? "ring-2 ring-blue-400 dark:ring-blue-500/60"
                              : isFirst
                                ? "ring-2 ring-amber-400 dark:ring-amber-500/60"
                                : isSecond
                                  ? "ring-2 ring-slate-300 dark:ring-slate-500/60"
                                  : isThird
                                    ? "ring-2 ring-orange-300 dark:ring-orange-500/60"
                                    : "";

                            const bgClass = isCurrentUser && !isTop3
                              ? "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-500/10 dark:to-cyan-500/5"
                              : isFirst
                                ? "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-500/10 dark:to-yellow-500/5"
                                : isSecond
                                  ? "bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-500/10 dark:to-gray-500/5"
                                  : isThird
                                    ? "bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-500/10 dark:to-amber-500/5"
                                    : "bg-slate-50 dark:bg-slate-800/50";

                            return (
                              <motion.div
                                key={entry.rank}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.45 + entry.rank * 0.04 }}
                                className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${ringClass} ${bgClass} ${
                                  isTop3 || isCurrentUser ? "border-transparent" : "border-slate-100 dark:border-slate-700/50"
                                } ${isTop3 ? "shadow-sm" : ""}`}
                              >
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                                  {rankIcon ? (
                                    <span className="text-lg leading-none">{rankIcon}</span>
                                  ) : (
                                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{entry.rank}</span>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${isCurrentUser ? "text-blue-700 dark:text-blue-300" : isFirst ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-200"}`}>
                                    <span className="truncate">{entry.user_name}</span>
                                    {isCurrentUser && <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">You</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                    {entry.tests_taken} test{entry.tests_taken !== 1 ? "s" : ""}
                                  </div>
                                </div>
                                <div className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                                  isFirst
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                                    : isTop3
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                }`}>
                                  {entry.mcqs_solved} MCQs
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 shadow-inner dark:from-amber-500/15 dark:to-orange-500/10">
                          <Lock className="h-6 w-6 text-amber-500 dark:text-amber-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pro Feature</p>
                          <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                            Unlock Pro to see top performers and compete with the best students.
                          </p>
                        </div>
                        <button className="mt-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/25 transition-all hover:scale-105 hover:shadow-amber-500/40">
                          Upgrade to Pro
                        </button>
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

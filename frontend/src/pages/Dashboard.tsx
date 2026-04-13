import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Clock, Award, AlertTriangle, Flame, BarChart3, ArrowUpRight, FileText, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { apiClient, type DashboardStats } from "@/services/api";

const SUBJECT_COLORS = [
  "from-violet-500 to-purple-500",
  "from-cyan-500 to-sky-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-violet-500",
];

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    apiClient
      .getDashboardStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const userName = stats?.user_name ?? "Student";

  // Deduplicate subjects by name (merge topic_count & mcq_count for duplicates)
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
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-20 pb-16">

        {/* ── ambient blobs ── */}
        <motion.div aria-hidden animate={{ x: [0, 22, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, -18, 0], y: [0, 16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, 10, 0], y: [0, -10, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/10 blur-3xl" />

        {loading ? (
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : (
        <div className="container relative mx-auto px-4">

          {/* ── HERO HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-7 shadow-2xl shadow-violet-400/30"
          >
            <motion.div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              animate={{ x: [0, 16, 0], y: [0, -14, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl"
              animate={{ x: [0, -12, 0], y: [0, 12, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                  <Flame className="h-3.5 w-3.5 text-amber-300" /> {totalSubjects} subjects loaded 📚
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  {greetingByTime}, {userName}! 👋
                </h1>
                <p className="mt-1.5 text-sm text-violet-200">Here's your preparation overview for today.</p>
              </div>
              <div className="flex gap-2">
                {[...Array(Math.min(totalSubjects, 7))].map((_, i) => (
                  <div key={i} className="h-8 w-2 rounded-full bg-white/80" />
                ))}
              </div>
            </div>

            {/* dots row */}
            <div className="relative z-10 mt-5 flex gap-1.5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
              ))}
            </div>
          </motion.div>

          {/* ── STAT CARDS ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
          >
            {[
              { label: "Subjects",    value: String(totalSubjects), icon: Flame,     bar: "from-violet-400 to-purple-500",  bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-100" },
              { label: "Topics",      value: String(totalTopics),   icon: Target,    bar: "from-fuchsia-400 to-pink-500",   bg: "bg-fuchsia-50", text: "text-fuchsia-600", border: "border-fuchsia-100" },
              { label: "Total MCQs",  value: String(totalMcqs),     icon: TrendingUp,bar: "from-cyan-400 to-sky-500",       bg: "bg-cyan-50",    text: "text-cyan-600",    border: "border-cyan-100" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                whileHover={{ y: -4, transition: { type: "spring", stiffness: 320, damping: 22 } }}
                className={`bg-white rounded-2xl p-5 shadow-md border ${stat.border} hover:shadow-lg transition-shadow duration-300 cursor-pointer group overflow-hidden relative`}
              >
                {/* top accent bar */}
                <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${stat.bar}`} />
                <div className="flex items-center justify-between mb-3 mt-1">
                  <div className={`${stat.bg} p-2.5 rounded-xl`}>
                    <stat.icon className={`h-5 w-5 ${stat.text}`} />
                  </div>
                  <ArrowUpRight className={`h-4 w-4 ${stat.text} opacity-0 group-hover:opacity-100 transition-opacity duration-200`} />
                </div>
                <div className="text-2xl font-black text-slate-800">{stat.value}</div>
                <div className="text-xs text-slate-400 font-medium mt-0.5">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* ── MAIN GRID ── */}
          <div className="grid lg:grid-cols-3 gap-6">

            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-6">

              {/* Weekly Performance Chart */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-2xl p-6 shadow-md border border-violet-100"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                      <BarChart3 className="h-4 w-4 text-violet-600" />
                    </span>
                    Content by Subject
                  </h2>
                  <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full font-semibold">MCQs</span>
                </div>
                <div className="flex items-end gap-2 sm:gap-3 h-44">
                  {uniqueSubjects.slice(0, 7).map((s, i) => {
                    const pct = maxMcqs > 0 ? Math.round((s.mcq_count / maxMcqs) * 100) : 0;
                    const isMax = s.mcq_count === maxMcqs;
                    return (
                      <div key={s.id} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer" title={`${s.name}: ${s.mcq_count} MCQs, ${s.topic_count} topics`}>
                        <span className="text-[11px] text-slate-500 font-semibold group-hover:text-violet-600 transition-colors">{s.mcq_count}</span>
                        <motion.div
                          className={`w-full rounded-t-xl transition-colors ${isMax ? "bg-gradient-to-t from-violet-600 to-fuchsia-500 shadow-md shadow-violet-200" : "bg-gradient-to-t from-violet-200 to-violet-100 group-hover:from-violet-400 group-hover:to-violet-300"}`}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(pct, 5)}%` }}
                          transition={{ delay: 0.3 + i * 0.06, duration: 0.5, ease: "easeOut" }}
                        />
                        <span className={`text-[11px] font-semibold ${isMax ? "text-violet-600" : "text-slate-400 group-hover:text-violet-500"} transition-colors`}>{s.name.slice(0, 4)}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Subject Progress */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white rounded-2xl p-6 shadow-md border border-violet-100"
              >
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-semibold text-slate-800 flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                      <BookOpen className="h-4 w-4 text-violet-600" />
                    </span>
                    Subject Progress
                  </h2>
                </div>
                <div className="space-y-4">
                  {progressData.map((s, i) => (
                    <div key={s.subject} className="group">
                      <div className="flex justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">{s.subject}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{s.topics} topics · {s.mcqs} MCQs</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">{s.progress}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full bg-gradient-to-r ${s.color} rounded-full`}
                          initial={{ width: 0 }}
                          animate={{ width: `${s.progress}%` }}
                          transition={{ delay: 0.4 + i * 0.07, duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Needs Attention */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-2xl p-6 shadow-md border border-amber-100"
              >
                <h2 className="font-semibold text-slate-800 mb-5 flex items-center gap-2 text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </span>
                  Needs Attention
                </h2>
                <div className="space-y-3">
                  {uniqueSubjects
                    .filter((s) => s.mcq_count < 10)
                    .slice(0, 3)
                    .map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50/70 to-orange-50/50 border border-amber-100">
                      <div>
                        <div className="font-semibold text-sm text-slate-800">{s.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{s.topic_count} topics</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600">
                        {s.mcq_count} MCQs
                      </span>
                    </div>
                  ))}
                  {uniqueSubjects.filter((s) => s.mcq_count < 10).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">All subjects have good MCQ coverage!</p>
                  )}
                </div>
              </motion.div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">

              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-md"
              >
                <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5">
                  <h2 className="font-bold text-sm text-white flex items-center gap-2">
                    <Target className="h-4 w-4" /> Quick Actions
                  </h2>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    { to: "/practice",  icon: Target,   label: "Take a Quiz",           pill: "bg-violet-100 text-violet-700",  border: "hover:border-violet-300" },
                    { to: "/ai-tutor",  icon: Brain,    label: "Ask AI Tutor",          pill: "bg-fuchsia-100 text-fuchsia-700",border: "hover:border-fuchsia-300" },
                    { to: "/usat",      icon: BookOpen, label: "Open USAT Hub",         pill: "bg-cyan-100 text-cyan-700",      border: "hover:border-cyan-300" },
                    { to: "/admin",     icon: Award,    label: "Admin Content Studio",  pill: "bg-emerald-100 text-emerald-700",border: "hover:border-emerald-300" },
                  ].map((a, i) => (
                    <Link
                      key={i}
                      to={a.to}
                      className={`group flex items-center gap-3 w-full rounded-xl px-3.5 py-2.5 border border-slate-100 bg-slate-50 transition-all duration-200 ${a.border} hover:bg-white hover:shadow-sm`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${a.pill}`}>
                        <a.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm font-semibold text-slate-700 flex-1">{a.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* AI Suggestions */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-white shadow-md"
              >
                <div className="bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3.5">
                  <h2 className="font-bold text-sm text-white flex items-center gap-2">
                    <Brain className="h-4 w-4" /> AI Suggestions
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { title: "Practice MCQs", desc: `You have ${totalMcqs} MCQs available — start a quiz!`, icon: Target },
                    { title: "Explore Subjects", desc: `${totalSubjects} subjects with ${totalTopics} topics to study.`, icon: BookOpen },
                    { title: "Ask AI Tutor", desc: "Get instant help with any topic or question.", icon: Brain },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gradient-to-r from-fuchsia-50/60 to-pink-50/40 border border-fuchsia-100">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-fuchsia-100">
                        <s.icon className="h-3.5 w-3.5 text-fuchsia-600" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.desc}</div>
                      </div>
                    </div>
                  ))}
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
import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Clock, Award, AlertTriangle, Flame, BarChart3, ArrowUpRight, FileText, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

const progressData = [
  { subject: "English",     progress: 72, color: "from-violet-500 to-purple-500" },
  { subject: "Mathematics", progress: 58, color: "from-cyan-500 to-sky-500" },
  { subject: "Physics",     progress: 45, color: "from-amber-500 to-orange-500" },
  { subject: "Chemistry",   progress: 63, color: "from-emerald-500 to-teal-500" },
  { subject: "Biology",     progress: 34, color: "from-rose-500 to-pink-500" },
  { subject: "Islamiat",    progress: 80, color: "from-indigo-500 to-violet-500" },
];

const recentActivity = [
  { type: "quiz",  title: "English Vocabulary Quiz",       score: "8/10", time: "2 hours ago",  icon: Target },
  { type: "study", title: "Physics: Newton's Laws",                        time: "5 hours ago",  icon: BookOpen },
  { type: "ai",    title: "AI Tutor: Math Problem Solving",                time: "Yesterday",    icon: Brain },
  { type: "essay", title: "Essay: Climate Change",          score: "B+",   time: "Yesterday",    icon: FileText },
  { type: "quiz",  title: "Chemistry MCQs - Organic",       score: "7/10", time: "2 days ago",   icon: Target },
];

const weakAreas = [
  { topic: "Quadratic Equations", subject: "Mathematics", accuracy: 35 },
  { topic: "Thermodynamics",      subject: "Physics",     accuracy: 40 },
  { topic: "Organic Chemistry",   subject: "Chemistry",   accuracy: 42 },
];

const suggestions = [
  { title: "Revise Quadratic Equations", desc: "Your accuracy is low. Try practice set #4.",        icon: AlertTriangle },
  { title: "Take Physics Mock Test",     desc: "You haven't practiced Physics in 3 days.",          icon: Target },
  { title: "Essay Writing Practice",     desc: "Improve your writing score with AI feedback.",      icon: FileText },
];

const weeklyScores = [65, 70, 68, 75, 72, 78, 82];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ACTIVITY_COLORS: Record<string, string> = {
  quiz:  "bg-violet-100 text-violet-600",
  study: "bg-cyan-100 text-cyan-600",
  ai:    "bg-fuchsia-100 text-fuchsia-600",
  essay: "bg-amber-100 text-amber-600",
};

const Dashboard = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

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
                  <Flame className="h-3.5 w-3.5 text-amber-300" /> 7-day streak 🔥
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  Welcome back, Pandaa! 👋
                </h1>
                <p className="mt-1.5 text-sm text-violet-200">Here's your preparation overview for today.</p>
              </div>
              <div className="flex gap-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`h-8 w-2 rounded-full ${i < 7 ? "bg-white/80" : "bg-white/20"}`} />
                ))}
              </div>
            </div>

            {/* mini stat chips inside hero */}
            <div className="relative z-10 mt-6 flex flex-wrap gap-3">
              {[
                { label: "Quizzes", value: "42",   color: "bg-white/15" },
                { label: "Accuracy", value: "74%", color: "bg-white/15" },
                { label: "Hours",   value: "126h",  color: "bg-white/15" },
              ].map(chip => (
                <div key={chip.label} className={`${chip.color} backdrop-blur-sm rounded-2xl border border-white/20 px-4 py-2`}>
                  <div className="text-lg font-black text-white">{chip.value}</div>
                  <div className="text-[10px] text-violet-200 font-medium">{chip.label}</div>
                </div>
              ))}
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
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
          >
            {[
              { label: "Study Streak",  value: "7 Days", icon: Flame,     bar: "from-violet-400 to-purple-500",  bg: "bg-violet-50",  text: "text-violet-600",  border: "border-violet-100" },
              { label: "Quizzes Taken", value: "42",      icon: Target,    bar: "from-fuchsia-400 to-pink-500",   bg: "bg-fuchsia-50", text: "text-fuchsia-600", border: "border-fuchsia-100" },
              { label: "Avg Accuracy",  value: "74%",     icon: TrendingUp,bar: "from-cyan-400 to-sky-500",       bg: "bg-cyan-50",    text: "text-cyan-600",    border: "border-cyan-100" },
              { label: "Hours Studied", value: "126h",    icon: Clock,     bar: "from-emerald-400 to-teal-500",   bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
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
                    Weekly Performance
                  </h2>
                  <span className="text-xs text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full font-semibold">This week</span>
                </div>
                <div className="flex items-end gap-2 sm:gap-3 h-44">
                  {weeklyScores.map((score, i) => {
                    const isToday = i === 6;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-semibold">{score}%</span>
                        <div
                          className={`w-full rounded-t-xl transition-all ${isToday ? "bg-gradient-to-t from-violet-600 to-fuchsia-500 shadow-md shadow-violet-200" : "bg-gradient-to-t from-violet-200 to-violet-100"}`}
                          style={{ height: `${score}%` }}
                        />
                        <span className={`text-[11px] font-semibold ${isToday ? "text-violet-600" : "text-slate-400"}`}>{days[i]}</span>
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
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-semibold text-slate-700">{s.subject}</span>
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

              {/* Weak Areas */}
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
                  Weak Areas
                </h2>
                <div className="space-y-3">
                  {weakAreas.map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50/70 to-orange-50/50 border border-amber-100">
                      <div>
                        <div className="font-semibold text-sm text-slate-800">{w.topic}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{w.subject}</div>
                      </div>
                      <span className="shrink-0 rounded-full bg-rose-100 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-600">
                        {w.accuracy}%
                      </span>
                    </div>
                  ))}
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
                  {suggestions.map((s, i) => (
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

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-md"
              >
                <div className="bg-gradient-to-r from-cyan-500 to-sky-500 px-5 py-3.5">
                  <h2 className="font-bold text-sm text-white flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Recent Activity
                  </h2>
                </div>
                <div className="p-4 space-y-3">
                  {recentActivity.map((a, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${ACTIVITY_COLORS[a.type] ?? "bg-slate-100 text-slate-500"}`}>
                        <a.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-700 truncate">{a.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{a.time}</div>
                      </div>
                      {a.score && (
                        <span className="shrink-0 rounded-full bg-violet-100 border border-violet-200 px-2 py-0.5 text-[10px] font-bold text-violet-600">
                          {a.score}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
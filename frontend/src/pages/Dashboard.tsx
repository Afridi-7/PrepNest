import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Award, AlertTriangle, Flame, BarChart3, ArrowUpRight, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { apiClient, type DashboardStats } from "@/services/api";

const SUBJECT_COLORS = [
  "from-blue-500 to-blue-500",
  "from-cyan-500 to-sky-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-indigo-500 to-blue-500",
];

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
                <div className="flex gap-2">
                  {[...Array(Math.min(totalSubjects, 7))].map((_, i) => (
                    <div key={i} className="h-8 w-2 rounded-full bg-white/80" />
                  ))}
                </div>
              </div>

              <div className="relative z-10 mt-5 flex gap-1.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
                ))}
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
                      .slice(0, 3)
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
                      { title: "Explore Subjects", desc: `${totalSubjects} subjects with ${totalTopics} topics to study.`, icon: BookOpen },
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
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Dashboard;

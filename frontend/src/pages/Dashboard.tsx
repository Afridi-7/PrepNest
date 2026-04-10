import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Clock, Award, AlertTriangle, Flame, BarChart3, ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

const progressData = [
  { subject: "English", progress: 72 },
  { subject: "Mathematics", progress: 58 },
  { subject: "Physics", progress: 45 },
  { subject: "Chemistry", progress: 63 },
  { subject: "Biology", progress: 34 },
  { subject: "Islamiat", progress: 80 },
];

const recentActivity = [
  { type: "quiz", title: "English Vocabulary Quiz", score: "8/10", time: "2 hours ago", icon: Target },
  { type: "study", title: "Physics: Newton's Laws", time: "5 hours ago", icon: BookOpen },
  { type: "ai", title: "AI Tutor: Math Problem Solving", time: "Yesterday", icon: Brain },
  { type: "essay", title: "Essay: Climate Change", score: "B+", time: "Yesterday", icon: FileText },
  { type: "quiz", title: "Chemistry MCQs - Organic", score: "7/10", time: "2 days ago", icon: Target },
];

const weakAreas = [
  { topic: "Quadratic Equations", subject: "Mathematics", accuracy: 35 },
  { topic: "Thermodynamics", subject: "Physics", accuracy: 40 },
  { topic: "Organic Chemistry", subject: "Chemistry", accuracy: 42 },
];

const suggestions = [
  { title: "Revise Quadratic Equations", desc: "Your accuracy is low. Try practice set #4.", icon: AlertTriangle },
  { title: "Take Physics Mock Test", desc: "You haven't practiced Physics in 3 days.", icon: Target },
  { title: "Essay Writing Practice", desc: "Improve your writing score with AI feedback.", icon: FileText },
];

const weeklyScores = [65, 70, 68, 75, 72, 78, 82];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const Dashboard = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-20 pb-12">

        {/* ── ambient blobs ── */}
        <motion.div aria-hidden animate={{ x: [0, 22, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, -18, 0], y: [0, 16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />

        <div className="container relative mx-auto px-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">Welcome back, Pandaa! 👋</h1>
          <p className="text-slate-500 mt-1">Here's your preparation overview.</p>
        </motion.div>

        {/* Top Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Study Streak", value: "7 Days", icon: Flame, gradient: "from-violet-500 to-purple-600", light: "bg-violet-50", text: "text-violet-600" },
            { label: "Quizzes Taken", value: "42", icon: Target, gradient: "from-fuchsia-500 to-pink-600", light: "bg-fuchsia-50", text: "text-fuchsia-600" },
            { label: "Avg Accuracy", value: "74%", icon: TrendingUp, gradient: "from-purple-500 to-violet-600", light: "bg-purple-50", text: "text-purple-600" },
            { label: "Hours Studied", value: "126h", icon: Clock, gradient: "from-indigo-500 to-violet-600", light: "bg-indigo-50", text: "text-indigo-600" },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-white rounded-2xl p-5 shadow-lg shadow-violet-100/40 border border-violet-100 hover:shadow-xl hover:shadow-violet-200/40 transition-all duration-300 hover:-translate-y-1 cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`bg-gradient-to-br ${stat.gradient} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <ArrowUpRight className={`h-4 w-4 ${stat.text} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
              <div className="font-heading text-2xl font-bold text-slate-800">{stat.value}</div>
              <div className="text-xs text-slate-500 font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Weekly Performance Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-violet-600" /> Weekly Performance
                </h2>
                <span className="text-xs text-slate-400 bg-violet-50 px-2.5 py-1 rounded-full font-medium">This week</span>
              </div>
              <div className="flex items-end gap-3 h-40">
                {weeklyScores.map((score, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">{score}%</span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-500 to-fuchsia-400 transition-all" style={{ height: `${score}%` }} />
                    <span className="text-xs text-slate-400">{days[i]}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Subject Progress */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <h2 className="font-heading font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-violet-600" /> Subject Progress
              </h2>
              <div className="space-y-4">
                {progressData.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-slate-700">{s.subject}</span>
                      <span className="text-slate-400 font-medium">{s.progress}%</span>
                    </div>
                    <div className="h-2 bg-violet-50 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-700" style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Weak Areas */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <h2 className="font-heading font-semibold text-slate-800 mb-5 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Weak Areas
              </h2>
              <div className="space-y-3">
                {weakAreas.map((w, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-xl bg-gradient-to-r from-violet-50/60 to-fuchsia-50/40 border border-violet-100/70">
                    <div>
                      <div className="font-medium text-sm text-slate-700">{w.topic}</div>
                      <div className="text-xs text-slate-400">{w.subject}</div>
                    </div>
                    <div className="text-sm font-semibold text-rose-500">{w.accuracy}% accuracy</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <h2 className="font-heading font-semibold text-slate-800 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {[
                  { to: "/practice", icon: Target, label: "Take a Quiz", color: "text-violet-600", bg: "bg-violet-50 hover:bg-violet-100" },
                  { to: "/ai-tutor", icon: Brain, label: "Ask AI Tutor", color: "text-fuchsia-600", bg: "bg-fuchsia-50 hover:bg-fuchsia-100" },
                  { to: "/usat", icon: BookOpen, label: "Open USAT Hub", color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100" },
                  { to: "/admin", icon: Award, label: "Admin Content Studio", color: "text-indigo-600", bg: "bg-indigo-50 hover:bg-indigo-100" },
                ].map((a, i) => (
                  <Link key={i} to={a.to} className={`flex items-center gap-3 w-full ${a.bg} rounded-xl px-4 py-3 transition-colors duration-200 border border-transparent hover:border-violet-200`}>
                    <a.icon className={`h-4 w-4 ${a.color}`} />
                    <span className="text-sm font-medium text-slate-700">{a.label}</span>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Suggestions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <h2 className="font-heading font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-fuchsia-600" /> AI Suggestions
              </h2>
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl bg-gradient-to-r from-violet-50/70 to-fuchsia-50/50 border border-violet-100">
                    <div className="flex items-start gap-2">
                      <s.icon className="h-4 w-4 text-violet-600 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{s.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{s.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-2xl p-6 shadow-lg shadow-violet-100/30 border border-violet-100">
              <h2 className="font-heading font-semibold text-slate-800 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center flex-shrink-0">
                      <a.icon className="h-4 w-4 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700 truncate">{a.title}</div>
                      <div className="text-xs text-slate-400">{a.time}</div>
                    </div>
                    {a.score && <span className="text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">{a.score}</span>}
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

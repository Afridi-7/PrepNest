import { useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Brain, Target, TrendingUp, Clock, Award, AlertTriangle, Flame, ChevronRight, BarChart3, ArrowUpRight, CheckCircle2, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

const progressData = [
  { subject: "English", progress: 72, color: "bg-blue-500" },
  { subject: "Mathematics", progress: 58, color: "bg-orange-500" },
  { subject: "Physics", progress: 45, color: "bg-purple-500" },
  { subject: "Chemistry", progress: 63, color: "bg-green-500" },
  { subject: "Biology", progress: 34, color: "bg-teal-500" },
  { subject: "Islamiat", progress: 80, color: "bg-red-500" },
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
      <div className="min-h-screen pt-20 pb-12">
        <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">Welcome back, Pandaa! 👋</h1>
          <p className="text-muted-foreground mt-1">Here's your preparation overview.</p>
        </motion.div>

        {/* Top Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Study Streak", value: "7 Days", icon: Flame, accent: "text-orange-600", bg: "bg-gradient-to-br from-orange-100 to-orange-200", border: "border-orange-300" },
            { label: "Quizzes Taken", value: "42", icon: Target, accent: "text-purple-600", bg: "bg-gradient-to-br from-purple-100 to-purple-200", border: "border-purple-300" },
            { label: "Avg Accuracy", value: "74%", icon: TrendingUp, accent: "text-green-600", bg: "bg-gradient-to-br from-green-100 to-green-200", border: "border-green-300" },
            { label: "Hours Studied", value: "126h", icon: Clock, accent: "text-blue-600", bg: "bg-gradient-to-br from-blue-100 to-blue-200", border: "border-blue-300" },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className={`bg-white rounded-2xl p-5 shadow-lg border-2 ${stat.border} hover:shadow-xl transition-all duration-300 hover:-translate-y-2 cursor-pointer group`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`${stat.bg} p-3 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                  <stat.icon className={`h-6 w-6 ${stat.accent}`} />
                </div>
                <ArrowUpRight className={`h-4 w-4 ${stat.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
              <div className="font-heading text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Weekly Performance Chart */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> Weekly Performance
                </h2>
                <span className="text-xs text-muted-foreground">This week</span>
              </div>
              <div className="flex items-end gap-3 h-40">
                {weeklyScores.map((score, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">{score}%</span>
                    <div className="w-full rounded-t-lg gradient-primary transition-all" style={{ height: `${score}%` }} />
                    <span className="text-xs text-muted-foreground">{days[i]}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Subject Progress */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Subject Progress
              </h2>
              <div className="space-y-4">
                {progressData.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium text-foreground">{s.subject}</span>
                      <span className="text-muted-foreground">{s.progress}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Weak Areas */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" /> Weak Areas
              </h2>
              <div className="space-y-3">
                {weakAreas.map((w, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-3 rounded-lg bg-secondary/50">
                    <div>
                      <div className="font-medium text-sm text-foreground">{w.topic}</div>
                      <div className="text-xs text-muted-foreground">{w.subject}</div>
                    </div>
                    <div className="text-sm font-medium text-destructive">{w.accuracy}% accuracy</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-heading font-semibold text-foreground mb-4">Quick Actions</h2>
              <div className="space-y-2">
                <Link to="/practice">
                  <Button variant="outline" className="w-full justify-start gap-2"><Target className="h-4 w-4" /> Take a Quiz</Button>
                </Link>
                <Link to="/ai-tutor">
                  <Button variant="outline" className="w-full justify-start gap-2"><Brain className="h-4 w-4" /> Ask AI Tutor</Button>
                </Link>
                <Link to="/subjects">
                  <Button variant="outline" className="w-full justify-start gap-2"><BookOpen className="h-4 w-4" /> Browse Subjects</Button>
                </Link>
                <Link to="/admin">
                  <Button variant="outline" className="w-full justify-start gap-2"><Award className="h-4 w-4" /> Admin Content Studio</Button>
                </Link>
              </div>
            </motion.div>

            {/* Suggestions */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" /> AI Suggestions
              </h2>
              <div className="space-y-3">
                {suggestions.map((s, i) => (
                  <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-start gap-2">
                      <s.icon className="h-4 w-4 text-primary mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{s.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card rounded-xl p-6 shadow-card">
              <h2 className="font-heading font-semibold text-foreground mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <a.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.time}</div>
                    </div>
                    {a.score && <span className="text-xs font-medium text-success">{a.score}</span>}
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

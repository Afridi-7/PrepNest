import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Target,
  BarChart3,
  Sparkles,
  ArrowRight,
  Users,
  Award,
  Zap,
  CheckCircle2,
  Star,
  Clock,
  FileText,
  Layers,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BookOpen, title: "Subject-Wise Learning", desc: "Structured content for USAT & HAT covering all subjects with topic breakdowns and curated resources." },
  { icon: Brain, title: "AI-Powered Tutor", desc: "Get instant explanations, step-by-step math solutions, and essay feedback from your personal AI." },
  { icon: Target, title: "Configurable Practice", desc: "Choose your MCQ count, set a timer, and take focused practice tests with instant scoring." },
  { icon: BarChart3, title: "Performance Analytics", desc: "Track accuracy, time taken, weak topics and get AI-driven study recommendations." },
  { icon: FileText, title: "Past Papers & Mocks", desc: "Access real past paper MCQs and full-length mock tests for every subject." },
  { icon: Layers, title: "Curated Materials", desc: "Notes, video links, cheat sheets, and resources aggregated from top educational sources." },
];

const stats = [
  { value: "10K+", label: "Students", icon: Users },
  { value: "2000+", label: "Practice MCQs", icon: Target },
  { value: "95%", label: "Success Rate", icon: Award },
  { value: "24/7", label: "AI Support", icon: Zap },
];

const testimonials = [
  { name: "Ayaan", exam: "USAT", quote: "PrepNest helped me score in the top 5%. The AI tutor explained concepts better than any textbook.", rating: 5 },
  { name: "Pandaa", exam: "HAT", quote: "The practice system is amazing. I could customize exactly how many MCQs and time I needed.", rating: 5 },
  { name: "Khkulaa", exam: "USAT", quote: "Past papers and mock tests gave me the real exam feel. Highly recommend to every student.", rating: 5 },
];

const subjects = [
  { name: "English", color: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
  { name: "Mathematics", color: "bg-gradient-to-r from-orange-500 to-orange-600 text-white" },
  { name: "Physics", color: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
  { name: "Chemistry", color: "bg-gradient-to-r from-green-500 to-green-600 text-white" },
  { name: "Biology", color: "bg-gradient-to-r from-teal-500 to-teal-600 text-white" },
  { name: "Islamiat", color: "bg-gradient-to-r from-red-500 to-red-600 text-white" },
  { name: "Logical Reasoning", color: "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Landing = () => (
  <div className="min-h-screen bg-background text-foreground">
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50/40 pb-16 pt-24 sm:pb-24 sm:pt-32 dark:from-slate-950 dark:to-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,hsl(217_91%_60%/0.08),transparent)] dark:bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,hsl(213_94%_68%/0.12),transparent)]" />
      <div className="absolute inset-0 pattern-dots opacity-20 dark:opacity-10" />

      <div className="container relative mx-auto px-4">
        <motion.div
          className="mx-auto max-w-3xl text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-gradient-to-r from-blue-100 to-cyan-100 px-5 py-2 text-sm font-bold text-blue-700 shadow-lg animate-pulse-glow dark:border-blue-500/30 dark:from-blue-500/20 dark:to-cyan-500/20 dark:text-blue-100 dark:shadow-blue-950/30">
            <Sparkles className="h-4 w-4 animate-bounce-subtle text-blue-600 dark:text-blue-200" />
            AI-Powered Test Preparation
          </div>
          <h1 className="mb-6 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-6xl">
            Ace Your <span className="gradient-text-animated">USAT & HAT</span> with PrepNest AI
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-base font-medium text-slate-700 sm:text-lg dark:text-slate-300">
            PrepNest AI is an AI-powered test preparation platform for Pakistani students. It combines smart learning, past papers, mock tests, AI tutoring, and adaptive practice - everything you need to ace your USAT & HAT exams in one place.
          </p>
          <div className="mx-auto flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:max-w-none sm:flex-row sm:items-center sm:gap-4">
            <Link to="/usat" className="w-full sm:w-auto">
              <Button size="lg" variant="gradient" className="group gap-2 px-10">
                Start Learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/practice" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-slate-200 bg-white px-10 hover:border-primary hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                Take a Practice Test
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mx-auto mt-16 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="group cursor-pointer rounded-2xl border-2 border-blue-200 bg-white p-4 text-center shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl dark:border-blue-500/20 dark:bg-slate-900 dark:shadow-black/25 sm:p-5"
            >
              <div className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100 p-2.5 transition-transform group-hover:scale-110 dark:from-blue-500/20 dark:to-cyan-500/20">
                <s.icon className="h-5 w-5 text-blue-600 dark:text-blue-200" />
              </div>
              <div className="mb-1 font-heading text-2xl font-bold text-foreground">{s.value}</div>
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>

    <section className="bg-white py-20 dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-blue-100 px-4 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/15 dark:text-blue-200">
            <Sparkles className="h-3.5 w-3.5" /> Why PrepNest?
          </span>
          <h2 className="mb-3 font-heading text-3xl font-bold text-foreground md:text-4xl">Everything You Need to Succeed</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">Comprehensive tools designed for USAT and HAT aspirants.</p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="card-hover group rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg transition-all duration-300 hover:border-blue-300 hover:shadow-xl dark:border-blue-500/20 dark:from-slate-900 dark:to-slate-900 dark:shadow-black/25 dark:hover:border-blue-500/40"
            >
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg shadow-blue-300/40 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 dark:shadow-blue-950/40">
                <f.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="mb-2 font-heading font-bold text-foreground">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-gradient-to-br from-blue-50/40 via-white to-cyan-50/30 py-20 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-cyan-200/60 bg-cyan-100 px-4 py-1.5 text-xs font-bold text-cyan-700 dark:border-cyan-500/20 dark:bg-cyan-500/15 dark:text-cyan-200">
            <BookOpen className="h-3.5 w-3.5" /> Complete Coverage
          </span>
          <h2 className="mb-3 font-heading text-3xl font-bold text-foreground md:text-4xl">Subjects We Cover</h2>
          <p className="text-muted-foreground">Covering all USAT and HAT exam subjects comprehensively.</p>
        </div>
        <div className="mx-auto mb-10 flex max-w-3xl flex-wrap justify-center gap-3">
          {subjects.map((s, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className={`cursor-pointer rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl dark:shadow-black/25 ${s.color}`}
            >
              {s.name}
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/usat">
            <Button variant="gradient" size="lg" className="gap-2">
              Explore USAT Categories <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>

    <section className="bg-white py-20 dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="mb-14 text-center">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-200/60 bg-amber-100 px-4 py-1.5 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-200">
            <Star className="h-3.5 w-3.5 fill-amber-500" /> Student Reviews
          </span>
          <h2 className="mb-3 font-heading text-3xl font-bold text-foreground md:text-4xl">What Students Say</h2>
          <p className="mx-auto max-w-xl text-muted-foreground">Thousands of students trust PrepNest for their exam preparation.</p>
        </div>
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="card-hover rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/50 p-6 shadow-lg transition-all duration-300 hover:border-blue-300 hover:shadow-xl dark:border-blue-500/20 dark:from-slate-900 dark:to-slate-900 dark:shadow-black/25 dark:hover:border-blue-500/40"
            >
              <div className="mb-4 flex gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="mb-5 text-sm italic leading-relaxed text-foreground dark:text-slate-200">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-sm font-bold text-white shadow-md shadow-blue-300/30 dark:shadow-blue-950/40">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs font-medium text-blue-600 dark:text-blue-300">{t.exam} Student</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <section className="border-y border-blue-200 bg-gradient-to-r from-blue-100 via-cyan-100/60 to-blue-100 py-10 dark:border-blue-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-center gap-6">
          {[
            { icon: Shield, label: "Verified Content", color: "text-emerald-500 dark:text-emerald-300" },
            { icon: Clock, label: "Updated Regularly", color: "text-blue-500 dark:text-blue-300" },
            { icon: CheckCircle2, label: "Exam-Aligned Syllabus", color: "text-cyan-500 dark:text-cyan-300" },
            { icon: Award, label: "Top Results", color: "text-amber-500 dark:text-amber-300" },
          ].map((item, i) => (
            <div key={i} className="flex cursor-default items-center gap-2.5 rounded-full border-2 border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md dark:border-blue-500/20 dark:bg-slate-900 dark:shadow-black/20 dark:hover:border-blue-500/40">
              <item.icon className={`h-4.5 w-4.5 ${item.color}`} /> {item.label}
            </div>
          ))}
        </div>
      </div>
    </section>

    <footer className="border-t border-slate-100 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 p-1">
              <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded object-contain" />
            </div>
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} PrepNest AI. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600 dark:hover:text-blue-300">Privacy Policy</Link>
            <Link to="/terms" className="text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600 dark:hover:text-blue-300">Terms of Service</Link>
            <Link to="/contact" className="text-sm font-medium text-muted-foreground transition-colors hover:text-blue-600 dark:hover:text-blue-300">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  </div>
);

export default Landing;

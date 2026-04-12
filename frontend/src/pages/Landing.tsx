import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BookOpen, Brain, Target, BarChart3, Sparkles, ArrowRight, Users, Award, Zap,
  CheckCircle2, Star, Clock, FileText, Layers, Shield
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
  { name: "Iqraa", exam: "USAT", quote: "PrepNest helped me score in the top 5%. The AI tutor explained concepts better than any textbook.", rating: 5 },
  { name: "Pandaa", exam: "HAT", quote: "The practice system is amazing. I could customize exactly how many MCQs and time I needed.", rating: 5 },
  { name: "Khkulaa", exam: "USAT", quote: "Past papers and mock tests gave me the real exam feel. Highly recommend to every student.", rating: 5 },
];

const subjects = [
  { name: "English", color: "bg-gradient-to-r from-blue-500 to-blue-600 text-white" },
  { name: "Mathematics", color: "bg-gradient-to-r from-orange-500 to-orange-600 text-white" },
  { name: "Physics", color: "bg-gradient-to-r from-purple-500 to-purple-600 text-white" },
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
  <div className="min-h-screen">
    {/* Hero */}
    <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden bg-gradient-to-br from-purple-50 via-blue-50 to-teal-50">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10" />
      <div className="absolute inset-0 pattern-dots opacity-30" />
      <div className="container mx-auto px-4 relative">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 text-sm font-bold mb-6 border-2 border-purple-300 shadow-xl animate-pulse-glow">
            <Sparkles className="h-4 w-4 animate-bounce-subtle text-purple-600" />
            AI-Powered Test Preparation
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Ace Your <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">USAT & HAT</span> with PrepNest AI
          </h1>
          <p className="text-base sm:text-lg text-gray-700 mb-8 max-w-2xl mx-auto font-medium">
            PrepNest AI is an AI-powered test preparation platform for Pakistani students. It combines smart learning, past papers, mock tests, AI tutoring, and adaptive practice — everything you need to ace your USAT & HAT exams in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none mx-auto">
            <Link to="/usat" className="w-full sm:w-auto">
              <Button size="lg" variant="gradient" className="px-10 gap-2 group">
                Start Learning <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/practice" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="px-10 w-full hover:border-primary hover:text-primary">Take a Practice Test</Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto"
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
              className="glass-strong rounded-2xl p-4 sm:p-5 text-center shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-2 cursor-pointer border border-primary/10 group"
            >
              <div className="bg-gradient-to-br from-primary/20 to-secondary/20 p-2.5 rounded-lg inline-flex mb-3 group-hover:scale-110 transition-transform">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="font-heading font-bold text-2xl text-foreground mb-1">{s.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>


    {/* Features */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">Everything You Need to Succeed</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Comprehensive tools designed for USAT and HAT aspirants.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((f, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 group border border-transparent hover:border-primary/20 hover:-translate-y-2"
            >
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-5 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg">
                <f.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Subjects Preview */}
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">Subjects We Cover</h2>
          <p className="text-muted-foreground">Covering all USAT and HAT exam subjects comprehensively.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 max-w-3xl mx-auto mb-10">
          {subjects.map((s, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className={`px-6 py-3 rounded-full font-semibold text-sm ${s.color} shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer`}
            >
              {s.name}
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/usat">
            <Button variant="gradient" size="lg" className="gap-2">Explore USAT Categories <ArrowRight className="h-5 w-5" /></Button>
          </Link>
        </div>
      </div>
    </section>

    {/* Testimonials */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-3">What Students Say</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Thousands of students trust PrepNest for their exam preparation.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="bg-gradient-to-br from-white to-primary/5 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-primary/10 hover:border-primary/30 hover:-translate-y-1"
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm text-foreground mb-5 italic leading-relaxed">"{t.quote}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold text-white shadow-md">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-primary font-medium">{t.exam} Student</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Trust Bar */}
    <section className="py-12 bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center items-center gap-8">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground bg-white px-4 py-2 rounded-full shadow-md">
            <Shield className="h-5 w-5 text-green-500" /> Verified Content
          </div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground bg-white px-4 py-2 rounded-full shadow-md">
            <Clock className="h-5 w-5 text-blue-500" /> Updated Regularly
          </div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground bg-white px-4 py-2 rounded-full shadow-md">
            <CheckCircle2 className="h-5 w-5 text-purple-500" /> Exam-Aligned Syllabus
          </div>
          <div className="flex items-center gap-2.5 text-sm font-semibold text-foreground bg-white px-4 py-2 rounded-full shadow-md">
            <Award className="h-5 w-5 text-orange-500" /> Top Results
          </div>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="py-10 bg-white border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} PrepNest AI. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-violet-600 transition-colors font-medium">Privacy Policy</Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-violet-600 transition-colors">Terms of Service</Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-violet-600 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>

  </div>
);

export default Landing;

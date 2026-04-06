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
  { name: "Ahmed R.", exam: "USAT", quote: "PrepNest helped me score in the top 5%. The AI tutor explained concepts better than any textbook.", rating: 5 },
  { name: "Fatima K.", exam: "HAT", quote: "The practice system is amazing. I could customize exactly how many MCQs and time I needed.", rating: 5 },
  { name: "Usman M.", exam: "USAT", quote: "Past papers and mock tests gave me the real exam feel. Highly recommend to every student.", rating: 5 },
];

const subjects = [
  { name: "English", color: "bg-info/10 text-info" },
  { name: "Mathematics", color: "bg-warning/10 text-warning" },
  { name: "Physics", color: "bg-primary/10 text-primary" },
  { name: "Chemistry", color: "bg-success/10 text-success" },
  { name: "Biology", color: "bg-accent/10 text-accent" },
  { name: "Islamiat", color: "bg-destructive/10 text-destructive" },
  { name: "Logical Reasoning", color: "bg-primary/10 text-primary" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const Landing = () => (
  <div className="min-h-screen">
    {/* Hero */}
    <section className="relative pt-32 pb-24 overflow-hidden">
      <div className="absolute inset-0 gradient-primary opacity-[0.04]" />
      <div className="absolute inset-0 pattern-dots" />
      <div className="container mx-auto px-4 relative">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            AI-Powered Test Preparation
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-6">
            Ace Your <span className="gradient-text">USAT & HAT</span> with AI
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            The next-generation platform combining smart learning, past papers, mock tests, AI tutoring, and adaptive practice — everything you need in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/subjects">
              <Button size="lg" className="gradient-primary text-primary-foreground border-0 px-8 gap-2">
                Start Learning <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/practice">
              <Button size="lg" variant="outline" className="px-8">Take a Practice Test</Button>
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
            <div key={i} className="glass rounded-xl p-4 text-center shadow-card">
              <s.icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <div className="font-heading font-bold text-xl text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
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
              className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300 group"
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="h-6 w-6 text-primary-foreground" />
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
        <div className="flex flex-wrap justify-center gap-3 max-w-2xl mx-auto mb-8">
          {subjects.map((s, i) => (
            <motion.div
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className={`px-5 py-3 rounded-full font-medium text-sm ${s.color} shadow-card`}
            >
              {s.name}
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/subjects">
            <Button variant="outline" className="gap-2">Browse All Subjects <ArrowRight className="h-4 w-4" /></Button>
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
              className="bg-card rounded-xl p-6 shadow-card"
            >
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-warning text-warning" />
                ))}
              </div>
              <p className="text-sm text-foreground mb-4 italic">"{t.quote}"</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.exam} Student</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Trust Bar */}
    <section className="py-12 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap justify-center items-center gap-8 text-muted-foreground">
          <div className="flex items-center gap-2 text-sm"><Shield className="h-4 w-4 text-success" /> Verified Content</div>
          <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-info" /> Updated Regularly</div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" /> Exam-Aligned Syllabus</div>
          <div className="flex items-center gap-2 text-sm"><Award className="h-4 w-4 text-warning" /> Top Results</div>
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="gradient-primary rounded-2xl p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 pattern-dots opacity-10" />
          <div className="relative">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Start Your Preparation Today
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Join thousands of students already using PrepNest to achieve their dream scores.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/subjects">
                <Button size="lg" className="bg-card text-foreground hover:bg-card/90 px-8 gap-2">
                  Explore Subjects <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/practice">
                <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 px-8">
                  Practice Now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-border py-8">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        © 2026 PrepNest. Built for USAT & HAT aspirants.
      </div>
    </footer>
  </div>
);

export default Landing;

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { BookOpen, Calculator, Atom, FlaskConical, Leaf, BookMarked, BrainCircuit, ArrowRight, ClipboardList, Layers, Lightbulb } from "lucide-react";
import Navbar from "@/components/Navbar";

const usatSubjects = [
  { id: "english", name: "English", icon: BookOpen, topics: 12, mcqs: 250, tips: 15, materials: 18, color: "from-info/20 to-info/5", accent: "text-info" },
  { id: "mathematics", name: "Mathematics", icon: Calculator, topics: 15, mcqs: 320, tips: 20, materials: 22, color: "from-warning/20 to-warning/5", accent: "text-warning" },
  { id: "physics", name: "Physics", icon: Atom, topics: 14, mcqs: 280, tips: 18, materials: 20, color: "from-primary/20 to-primary/5", accent: "text-primary" },
  { id: "chemistry", name: "Chemistry", icon: FlaskConical, topics: 13, mcqs: 260, tips: 16, materials: 19, color: "from-success/20 to-success/5", accent: "text-success" },
  { id: "biology", name: "Biology", icon: Leaf, topics: 11, mcqs: 200, tips: 12, materials: 15, color: "from-accent/20 to-accent/5", accent: "text-accent" },
  { id: "islamiat", name: "Islamiat", icon: BookMarked, topics: 8, mcqs: 150, tips: 10, materials: 12, color: "from-destructive/20 to-destructive/5", accent: "text-destructive" },
];

const hatSubjects = [
  { id: "hat-english", name: "English", icon: BookOpen, topics: 10, mcqs: 200, tips: 10, materials: 14, color: "from-info/20 to-info/5", accent: "text-info" },
  { id: "hat-mathematics", name: "Mathematics", icon: Calculator, topics: 12, mcqs: 280, tips: 14, materials: 18, color: "from-warning/20 to-warning/5", accent: "text-warning" },
  { id: "hat-reasoning", name: "Logical Reasoning", icon: BrainCircuit, topics: 9, mcqs: 180, tips: 8, materials: 10, color: "from-primary/20 to-primary/5", accent: "text-primary" },
];

type SubjectType = typeof usatSubjects[0];

const SubjectCard = ({ subject, i }: { subject: SubjectType; i: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.08 }}
  >
    <Link to={`/subjects/${subject.id}`} className="block group">
      <div className={`bg-gradient-to-br ${subject.color} rounded-xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border border-border/50`}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-card flex items-center justify-center shadow-sm">
            <subject.icon className={`h-6 w-6 ${subject.accent}`} />
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
        <h3 className="font-heading font-semibold text-foreground mb-1">{subject.name}</h3>
        <p className="text-sm text-muted-foreground mb-4">{subject.topics} topics</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ClipboardList className="h-3.5 w-3.5" />
            <span>{subject.mcqs} MCQs</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            <span>{subject.materials} Resources</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>{subject.tips} Tips & Tricks</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{subject.topics} Topics</span>
          </div>
        </div>
      </div>
    </Link>
  </motion.div>
);

const Subjects = () => (
  <>
    <Navbar />
    <div className="min-h-screen pt-24 pb-12">
      <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Subjects</h1>
          <p className="text-muted-foreground">Choose a subject to access topics, materials, mock tests, and past papers.</p>
        </motion.div>

        <div className="mb-12">
          <h2 className="font-heading text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <span className="gradient-primary text-primary-foreground text-xs px-2.5 py-1 rounded-full font-medium">USAT</span>
            Undergraduate Studies Admission Test
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usatSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} i={i} />)}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground mb-5 flex items-center gap-2">
            <span className="gradient-primary text-primary-foreground text-xs px-2.5 py-1 rounded-full font-medium">HAT</span>
            Higher Education Aptitude Test
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hatSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} i={i} />)}
          </div>
        </div>
      </div>
    </div>
  </>
);

export default Subjects;

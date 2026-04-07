import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BookOpen, Calculator, Atom, FlaskConical, Leaf, BookMarked, BrainCircuit, ArrowRight, ClipboardList, Layers, Lightbulb } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/services/api";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";

const usatSubjects = [
  { id: "english", name: "English", icon: BookOpen, topics: 12, mcqs: 250, tips: 15, materials: 18, color: "from-blue-400 to-blue-200", accent: "text-blue-600" },
  { id: "mathematics", name: "Mathematics", icon: Calculator, topics: 15, mcqs: 320, tips: 20, materials: 22, color: "from-orange-400 to-orange-200", accent: "text-orange-600" },
  { id: "physics", name: "Physics", icon: Atom, topics: 14, mcqs: 280, tips: 18, materials: 20, color: "from-purple-400 to-purple-200", accent: "text-purple-600" },
  { id: "chemistry", name: "Chemistry", icon: FlaskConical, topics: 13, mcqs: 260, tips: 16, materials: 19, color: "from-green-400 to-green-200", accent: "text-green-600" },
  { id: "biology", name: "Biology", icon: Leaf, topics: 11, mcqs: 200, tips: 12, materials: 15, color: "from-teal-400 to-teal-200", accent: "text-teal-600" },
  { id: "islamiat", name: "Islamiat", icon: BookMarked, topics: 8, mcqs: 150, tips: 10, materials: 12, color: "from-red-400 to-red-200", accent: "text-red-600" },
];

const hatSubjects = [
  { id: "hat-english", name: "English", icon: BookOpen, topics: 10, mcqs: 200, tips: 10, materials: 14, color: "from-blue-400 to-blue-200", accent: "text-blue-600" },
  { id: "hat-mathematics", name: "Mathematics", icon: Calculator, topics: 12, mcqs: 280, tips: 14, materials: 18, color: "from-orange-400 to-orange-200", accent: "text-orange-600" },
  { id: "hat-reasoning", name: "Logical Reasoning", icon: BrainCircuit, topics: 9, mcqs: 180, tips: 8, materials: 10, color: "from-indigo-400 to-indigo-200", accent: "text-indigo-600" },
];

type SubjectType = typeof usatSubjects[0];

const SubjectCard = ({
  subject,
  i,
  onOpen,
}: {
  subject: SubjectType;
  i: number;
  onOpen: (subjectId: string) => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.08 }}
  >
    <button onClick={() => onOpen(subject.id)} className="block group w-full text-left">
      <div className={`bg-gradient-to-br ${subject.color} rounded-2xl p-4 sm:p-6 shadow-card hover:shadow-card-hover transition-all duration-300 border-2 border-transparent hover:border-white/50 hover:-translate-y-2 group-hover:shadow-glow`}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
            <subject.icon className={`h-7 w-7 ${subject.accent}`} />
          </div>
          <ArrowRight className={`h-5 w-5 ${subject.accent} group-hover:translate-x-2 transition-transform duration-300`} />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground mb-1">{subject.name}</h3>
        <p className="text-sm text-muted-foreground mb-4 font-medium">{subject.topics} comprehensive topics</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium bg-white/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            <span>{subject.mcqs} MCQs</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium bg-white/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <Layers className="h-3.5 w-3.5" />
            <span>{subject.materials} Resources</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium bg-white/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>{subject.tips} Tips</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/80 font-medium bg-white/50 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span>{subject.topics} Topics</span>
          </div>
        </div>
      </div>
    </button>
  </motion.div>
);

const Subjects = () => {
  const navigate = useNavigate();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const handleOpenSubject = (subjectId: string) => {
    if (!apiClient.isAuthenticated()) {
      setAuthDialogOpen(true);
      return;
    }
    navigate(`/subjects/${subjectId}`);
  };

  return (
    <>
      <Navbar />
      <AuthRequiredDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        message="Please log in first to open subject details."
      />
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-2">Subjects</h1>
          <p className="text-muted-foreground">Choose a subject to access topics, materials, mock tests, and past papers.</p>
        </motion.div>

        <div className="mb-12">
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground mb-5 flex flex-wrap items-center gap-3">
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs px-4 py-2 rounded-full font-bold shadow-xl">USAT</span>
            <span className="text-gray-700">Undergraduate Studies Admission Test</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {usatSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} i={i} onOpen={handleOpenSubject} />)}
          </div>
        </div>

        <div>
          <h2 className="font-heading text-lg sm:text-xl font-semibold text-foreground mb-5 flex flex-wrap items-center gap-3">
            <span className="bg-gradient-to-r from-teal-600 to-green-600 text-white text-xs px-4 py-2 rounded-full font-bold shadow-xl">HAT</span>
            <span className="text-gray-700">Higher Education Aptitude Test</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hatSubjects.map((s, i) => <SubjectCard key={s.id} subject={s} i={i} onOpen={handleOpenSubject} />)}
          </div>
        </div>
      </div>
      </div>
    </>
  );
};

export default Subjects;

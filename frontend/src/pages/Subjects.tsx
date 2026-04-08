import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import Navbar from "@/components/Navbar";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import { apiClient, Subject } from "@/services/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SubjectCard = ({
  subject,
  i,
  onOpen,
}: {
  subject: Subject;
  i: number;
  onOpen: (subjectId: number) => void;
}) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
    <button onClick={() => onOpen(subject.id)} className="block group w-full text-left">
      <div className="bg-gradient-to-br from-cyan-100 to-blue-50 rounded-2xl p-5 shadow-card transition-all duration-300 border border-cyan-200 hover:-translate-y-1">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-md">
            <BookOpen className="h-6 w-6 text-cyan-700" />
          </div>
          <ArrowRight className="h-5 w-5 text-cyan-700 group-hover:translate-x-1 transition-transform duration-300" />
        </div>
        <h3 className="font-heading font-bold text-lg text-foreground mb-2">{subject.name}</h3>
        <p className="text-sm text-muted-foreground">Exam: {subject.exam_type}</p>
      </div>
    </button>
  </motion.div>
);

const Subjects = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadSubjects = async () => {
    try {
      const data = await apiClient.listSubjects();
      setSubjects(data);
    } catch {
      setSubjects([]);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    (async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const me = await apiClient.getCurrentUser();
          setIsAdmin(Boolean(me.is_admin));
        } catch {
          setIsAdmin(false);
        }
      }
      await loadSubjects();
    })();
  }, []);

  const seedDemo = async () => {
    try {
      const result = await apiClient.seedDemoContent();
      await loadSubjects();
      toast({
        description: `Seeded: ${result.created_subjects} subjects, ${result.created_topics} topics, ${result.created_materials} materials, ${result.created_mcqs} MCQs`,
      });
    } catch (error: any) {
      toast({ title: "Seed failed", description: error.message, variant: "destructive" });
    }
  };

  const groupedSubjects = useMemo(() => {
    const groups: Record<string, Subject[]> = {};
    for (const subject of subjects) {
      const key = (subject.exam_type || "General").toUpperCase();
      groups[key] = groups[key] || [];
      groups[key].push(subject);
    }
    return groups;
  }, [subjects]);

  const handleOpenSubject = (subjectId: number) => {
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
      <div className="min-h-screen pt-24 pb-12 bg-gradient-to-br from-white via-cyan-50 to-sky-100">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Subjects</h1>
            <p className="text-muted-foreground">Browse all subjects and open detailed learning content.</p>
            {isAdmin && (
              <div className="mt-4">
                <Button onClick={seedDemo} variant="outline">Seed Demo Subjects</Button>
              </div>
            )}
          </motion.div>

          {Object.keys(groupedSubjects).length === 0 ? (
            <div className="rounded-2xl border bg-white/80 p-6 text-muted-foreground">No subjects available yet.</div>
          ) : (
            Object.entries(groupedSubjects).map(([examType, group]) => (
              <div key={examType} className="mb-10">
                <h2 className="font-heading text-lg font-semibold text-foreground mb-4">{examType}</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.map((subject, i) => (
                    <SubjectCard key={subject.id} subject={subject} i={i} onOpen={handleOpenSubject} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default Subjects;

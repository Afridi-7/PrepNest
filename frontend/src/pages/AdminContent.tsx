import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, PlusCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient, Subject, Topic } from "@/services/api";

const AdminContent = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);

  const [subjectName, setSubjectName] = useState("");
  const [examType, setExamType] = useState("USAT");

  const [topicTitle, setTopicTitle] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState<number | "">("");

  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<"notes" | "past_paper">("notes");
  const [materialTopicId, setMaterialTopicId] = useState<number | "">("");
  const [materialContent, setMaterialContent] = useState("");

  const [mcqTopicId, setMcqTopicId] = useState<number | "">("");
  const [question, setQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState<"A" | "B" | "C" | "D">("A");
  const [explanation, setExplanation] = useState("");

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects]
  );
  const sortedTopics = useMemo(() => [...topics].sort((a, b) => a.title.localeCompare(b.title)), [topics]);

  const loadData = async () => {
    const profile = await apiClient.getCurrentUser();
    setIsAdmin(profile.is_admin);
    const fetchedSubjects = await apiClient.listSubjects();
    setSubjects(fetchedSubjects);

    const topicCollections = await Promise.all(fetchedSubjects.map((s) => apiClient.listTopics(s.id)));
    setTopics(topicCollections.flat());
  };

  useEffect(() => {
    (async () => {
      try {
        await loadData();
      } catch (error: any) {
        toast({ title: "Failed to load admin data", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createSubject({ name: subjectName.trim(), exam_type: examType.trim() });
      setSubjectName("");
      await loadData();
      toast({ description: "Subject created" });
    } catch (error: any) {
      toast({ title: "Create subject failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreateTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!topicSubjectId) return;
    try {
      await apiClient.createTopic({ title: topicTitle.trim(), subject_id: topicSubjectId });
      setTopicTitle("");
      await loadData();
      toast({ description: "Topic created" });
    } catch (error: any) {
      toast({ title: "Create topic failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreateMaterial = async (e: FormEvent) => {
    e.preventDefault();
    if (!materialTopicId) return;
    try {
      await apiClient.createMaterial({
        title: materialTitle.trim(),
        content: materialContent.trim(),
        type: materialType,
        topic_id: materialTopicId,
      });
      setMaterialTitle("");
      setMaterialContent("");
      toast({ description: "Material created" });
    } catch (error: any) {
      toast({ title: "Create material failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreateMCQ = async (e: FormEvent) => {
    e.preventDefault();
    if (!mcqTopicId) return;
    try {
      await apiClient.createMCQ({
        question: question.trim(),
        option_a: optionA.trim(),
        option_b: optionB.trim(),
        option_c: optionC.trim(),
        option_d: optionD.trim(),
        correct_answer: correctAnswer,
        explanation: explanation.trim(),
        topic_id: mcqTopicId,
      });
      setQuestion("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setExplanation("");
      toast({ description: "MCQ created" });
    } catch (error: any) {
      toast({ title: "Create MCQ failed", description: error.message, variant: "destructive" });
    }
  };

  if (!apiClient.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && !isAdmin) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen pt-24 px-4">
          <div className="container mx-auto max-w-xl bg-white rounded-2xl border p-8 shadow-sm text-center">
            <Shield className="h-8 w-8 mx-auto mb-3 text-red-500" />
            <h1 className="text-2xl font-bold mb-2">Admin Access Required</h1>
            <p className="text-muted-foreground">Your account does not have admin privileges.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-12 px-4 bg-gradient-to-br from-slate-50 via-cyan-50 to-white">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Admin Content Studio</h1>
            <p className="text-muted-foreground">Create subjects, topics, materials, and MCQs for learners.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <form onSubmit={onCreateSubject} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Subject</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Exam type (USAT/HAT)" value={examType} onChange={(e) => setExamType(e.target.value)} required />
              <Button type="submit" className="w-full">Save Subject</Button>
            </form>

            <form onSubmit={onCreateTopic} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Topic</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Topic title" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={topicSubjectId} onChange={(e) => setTopicSubjectId(Number(e.target.value))} required>
                <option value="">Select subject</option>
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                ))}
              </select>
              <Button type="submit" className="w-full">Save Topic</Button>
            </form>

            <form onSubmit={onCreateMaterial} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Material</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Material title" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={materialType} onChange={(e) => setMaterialType(e.target.value as "notes" | "past_paper")}>
                <option value="notes">Notes</option>
                <option value="past_paper">Past Paper</option>
              </select>
              <select className="w-full border rounded-lg px-3 py-2" value={materialTopicId} onChange={(e) => setMaterialTopicId(Number(e.target.value))} required>
                <option value="">Select topic</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-28" placeholder="Material content" value={materialContent} onChange={(e) => setMaterialContent(e.target.value)} required />
              <Button type="submit" className="w-full">Save Material</Button>
            </form>

            <form onSubmit={onCreateMCQ} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create MCQ</h2>
              <select className="w-full border rounded-lg px-3 py-2" value={mcqTopicId} onChange={(e) => setMcqTopicId(Number(e.target.value))} required>
                <option value="">Select topic</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-24" placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value as "A" | "B" | "C" | "D")}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-20" placeholder="Explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} required />
              <Button type="submit" className="w-full">Save MCQ</Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminContent;

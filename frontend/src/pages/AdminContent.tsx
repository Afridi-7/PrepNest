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
  const [examType, setExamType] = useState("USAT-E");

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
  const [pdfTopicId, setPdfTopicId] = useState<number | "">("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);

  const [pastPaperSubjectId, setPastPaperSubjectId] = useState<number | "">("");
  const [pastPaperYear, setPastPaperYear] = useState<number>(2025);
  const [pastPaperTitle, setPastPaperTitle] = useState("");
  const [pastPaperContent, setPastPaperContent] = useState("");
  const [pastPaperFile, setPastPaperFile] = useState<File | null>(null);

  const [tipSubjectId, setTipSubjectId] = useState<number | "">("");
  const [tipTitle, setTipTitle] = useState("");
  const [tipContent, setTipContent] = useState("");

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

  const onUploadPDFs = async (e: FormEvent) => {
    e.preventDefault();
    if (!pdfTopicId || pdfFiles.length === 0) return;
    try {
      await apiClient.uploadMaterialPDFs(pdfTopicId, pdfFiles);
      setPdfFiles([]);
      toast({ description: "PDFs uploaded and added as materials" });
    } catch (error: any) {
      toast({ title: "PDF upload failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreatePastPaper = async (e: FormEvent) => {
    e.preventDefault();
    if (!pastPaperSubjectId) return;
    try {
      await apiClient.createPastPaper({
        subject_id: pastPaperSubjectId,
        year: Number(pastPaperYear),
        title: pastPaperTitle.trim() || undefined,
        content: pastPaperContent.trim() || undefined,
        file: pastPaperFile || undefined,
      });
      setPastPaperTitle("");
      setPastPaperContent("");
      setPastPaperFile(null);
      toast({ description: "Past paper created" });
    } catch (error: any) {
      toast({ title: "Create past paper failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreateTip = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipSubjectId) return;
    try {
      await apiClient.createTip({
        title: tipTitle.trim(),
        content: tipContent.trim(),
        subject_id: tipSubjectId,
      });
      setTipTitle("");
      setTipContent("");
      toast({ description: "Tip added" });
    } catch (error: any) {
      toast({ title: "Create tip failed", description: error.message, variant: "destructive" });
    }
  };

  const onDedupeSubjects = async () => {
    try {
      const result = await apiClient.dedupeSubjects();
      await loadData();
      toast({
        description: `Removed ${result.removed_subjects} duplicate subjects, merged ${result.merged_topics} topics, moved ${result.moved_materials} materials, ${result.moved_mcqs} MCQs`,
      });
    } catch (error: any) {
      toast({ title: "Dedupe failed", description: error.message, variant: "destructive" });
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" onClick={onDedupeSubjects}>Remove Duplicate Subjects</Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <form onSubmit={onCreateSubject} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Subject</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setExamType("USAT-E")} className="text-xs px-3 py-1 rounded border bg-slate-50">USAT-E</button>
                <button type="button" onClick={() => setExamType("USAT-M")} className="text-xs px-3 py-1 rounded border bg-slate-50">USAT-M</button>
                <button type="button" onClick={() => setExamType("USAT-CS")} className="text-xs px-3 py-1 rounded border bg-slate-50">USAT-CS</button>
                <button type="button" onClick={() => setExamType("USAT-GS")} className="text-xs px-3 py-1 rounded border bg-slate-50">USAT-GS</button>
                <button type="button" onClick={() => setExamType("USAT-A")} className="text-xs px-3 py-1 rounded border bg-slate-50">USAT-A</button>
              </div>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Exam type (USAT-E/USAT-M/...)" value={examType} onChange={(e) => setExamType(e.target.value)} required />
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

            <form onSubmit={onUploadPDFs} className="rounded-2xl border bg-white p-5 space-y-3 md:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Upload Multiple PDFs</h2>
              <select className="w-full border rounded-lg px-3 py-2" value={pdfTopicId} onChange={(e) => setPdfTopicId(Number(e.target.value))} required>
                <option value="">Select topic</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <input
                className="w-full border rounded-lg px-3 py-2"
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setPdfFiles(Array.from(e.target.files || []))}
                required
              />
              {pdfFiles.length > 0 && (
                <p className="text-sm text-muted-foreground">{pdfFiles.length} PDF file(s) selected</p>
              )}
              <Button type="submit" className="w-full">Upload PDFs</Button>
            </form>

            <form onSubmit={onCreatePastPaper} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Past Paper</h2>
              <select className="w-full border rounded-lg px-3 py-2" value={pastPaperSubjectId} onChange={(e) => setPastPaperSubjectId(Number(e.target.value))} required>
                <option value="">Select subject</option>
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                ))}
              </select>
              <input className="w-full border rounded-lg px-3 py-2" type="number" min={2000} max={2100} value={pastPaperYear} onChange={(e) => setPastPaperYear(Number(e.target.value))} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Title (optional)" value={pastPaperTitle} onChange={(e) => setPastPaperTitle(e.target.value)} />
              <input className="w-full border rounded-lg px-3 py-2" type="file" accept="application/pdf" onChange={(e) => setPastPaperFile((e.target.files && e.target.files[0]) || null)} />
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-24" placeholder="Optional: PDF link path or markdown/text content" value={pastPaperContent} onChange={(e) => setPastPaperContent(e.target.value)} />
              <Button type="submit" className="w-full">Save Past Paper</Button>
            </form>

            <form onSubmit={onCreateTip} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add Tips & Tricks</h2>
              <select className="w-full border rounded-lg px-3 py-2" value={tipSubjectId} onChange={(e) => setTipSubjectId(Number(e.target.value))} required>
                <option value="">Select subject</option>
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                ))}
              </select>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Tip title" value={tipTitle} onChange={(e) => setTipTitle(e.target.value)} required />
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-24" placeholder="Study strategy / exam tip" value={tipContent} onChange={(e) => setTipContent(e.target.value)} required />
              <Button type="submit" className="w-full">Save Tip</Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminContent;

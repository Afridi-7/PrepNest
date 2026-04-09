import { FormEvent, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, PlusCircle, Trash2, Layers, FolderOpen, Pencil } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient, Material, Subject, Topic } from "@/services/api";

const AdminContent = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicMaterials, setTopicMaterials] = useState<Material[]>([]);

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
  const [manageSubjectId, setManageSubjectId] = useState<number | "">("");
  const [manageTopicId, setManageTopicId] = useState<number | "">("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  // Inline edit state
  const [editSubjectId, setEditSubjectId] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editMaterialId, setEditMaterialId] = useState<number | null>(null);
  const [editMaterialTitle, setEditMaterialTitle] = useState("");

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects]
  );
  const sortedTopics = useMemo(() => [...topics].sort((a, b) => a.title.localeCompare(b.title)), [topics]);
  const manageSubjectTopics = useMemo(
    () => sortedTopics.filter((topic) => (manageSubjectId ? topic.subject_id === manageSubjectId : true)),
    [sortedTopics, manageSubjectId]
  );

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

  useEffect(() => {
    (async () => {
      if (!manageTopicId) {
        setTopicMaterials([]);
        return;
      }
      try {
        const materials = await apiClient.listMaterials(manageTopicId);
        setTopicMaterials(materials);
      } catch {
        setTopicMaterials([]);
      }
    })();
  }, [manageTopicId]);

  const onCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createSubject({ name: subjectName.trim(), exam_type: examType.trim() });
      setSubjectName("");
      await loadData();
      toast({ description: "Subject created" });
    } catch (error: any) {
      console.error("Create subject failed", error);
      toast({ title: "Create subject failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
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
      console.error("Create topic failed", error);
      toast({ title: "Create topic failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
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
      if (manageTopicId === materialTopicId) {
        const refreshed = await apiClient.listMaterials(materialTopicId);
        setTopicMaterials(refreshed);
      }
      toast({ description: "Material created" });
    } catch (error: any) {
      console.error("Create material failed", error);
      toast({ title: "Create material failed", description: error?.message || String(error), variant: "destructive" });
      if (manageTopicId === materialTopicId) {
        const refreshed = await apiClient.listMaterials(materialTopicId);
        setTopicMaterials(refreshed);
      }
      await loadData();
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
      if (manageTopicId === pdfTopicId) {
        const refreshed = await apiClient.listMaterials(pdfTopicId);
        setTopicMaterials(refreshed);
      }
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

  const onEditSubject = (subject: Subject) => {
    setEditSubjectId(subject.id);
    setEditSubjectName(subject.name);
  };
  const onSaveEditSubject = async (subject: Subject) => {
    setActionBusy(`edit-subject-${subject.id}`);
    try {
      await apiClient.updateSubject(subject.id, { name: editSubjectName });
      setEditSubjectId(null);
      await loadData();
      toast({ description: "Subject renamed" });
    } catch (error: any) {
      console.error("Rename subject failed", error);
      toast({ title: "Rename subject failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
    } finally {
      setActionBusy(null);
    }
  };

  const onEditTopic = (topic: Topic) => {
    setEditTopicId(topic.id);
    setEditTopicTitle(topic.title);
  };
  const onSaveEditTopic = async (topic: Topic) => {
    setActionBusy(`edit-topic-${topic.id}`);
    try {
      await apiClient.updateTopic(topic.id, { title: editTopicTitle });
      setEditTopicId(null);
      await loadData();
      toast({ description: "Chapter renamed" });
    } catch (error: any) {
      console.error("Rename chapter failed", error);
      toast({ title: "Rename chapter failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
    } finally {
      setActionBusy(null);
    }
  };

  const onEditMaterial = (material: Material) => {
    setEditMaterialId(material.id);
    setEditMaterialTitle(material.title);
  };
  const onSaveEditMaterial = async (material: Material) => {
    setActionBusy(`edit-material-${material.id}`);
    try {
      await apiClient.updateMaterial(material.id, { title: editMaterialTitle });
      setEditMaterialId(null);
      if (manageTopicId) {
        const refreshed = await apiClient.listMaterials(manageTopicId);
        setTopicMaterials(refreshed);
      }
      toast({ description: "Material renamed" });
    } catch (error: any) {
      console.error("Rename material failed", error);
      toast({ title: "Rename material failed", description: error?.message || String(error), variant: "destructive" });
      if (manageTopicId) {
        const refreshed = await apiClient.listMaterials(manageTopicId);
        setTopicMaterials(refreshed);
      }
      await loadData();
    } finally {
      setActionBusy(null);
    }
  };
  const onDeleteSubject = async (subjectId: number, subjectLabel: string) => {
    if (!window.confirm(`Delete subject "${subjectLabel}" and all its chapters/materials/MCQs?`)) return;
    setActionBusy(`subject-${subjectId}`);
    try {
      await apiClient.deleteSubject(subjectId);
      if (manageSubjectId === subjectId) {
        setManageSubjectId("");
      }
      await loadData();
      toast({ description: "Subject deleted" });
    } catch (error: any) {
      console.error("Delete subject failed", error);
      toast({ title: "Delete subject failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
    } finally {
      setActionBusy(null);
    }
  };

  const onDeleteTopic = async (topicId: number, topicLabel: string) => {
    if (!window.confirm(`Delete chapter "${topicLabel}" and all contained materials/MCQs?`)) return;
    setActionBusy(`topic-${topicId}`);
    try {
      await apiClient.deleteTopic(topicId);
      if (manageTopicId === topicId) {
        setManageTopicId("");
      }
      await loadData();
      toast({ description: "Chapter deleted" });
    } catch (error: any) {
      console.error("Delete chapter failed", error);
      toast({ title: "Delete chapter failed", description: error?.message || String(error), variant: "destructive" });
      await loadData();
    } finally {
      setActionBusy(null);
    }
  };

  const onDeleteMaterial = async (materialId: number, materialLabel: string) => {
    if (!window.confirm(`Delete material "${materialLabel}"?`)) return;
    setActionBusy(`material-${materialId}`);
    try {
      await apiClient.deleteMaterial(materialId);
      if (manageTopicId) {
        const refreshed = await apiClient.listMaterials(manageTopicId);
        setTopicMaterials(refreshed);
      }
      toast({ description: "Material deleted" });
    } catch (error: any) {
      console.error("Delete material failed", error);
      toast({ title: "Delete material failed", description: error?.message || String(error), variant: "destructive" });
      if (manageTopicId) {
        const refreshed = await apiClient.listMaterials(manageTopicId);
        setTopicMaterials(refreshed);
      }
      await loadData();
    } finally {
      setActionBusy(null);
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
            <p className="text-muted-foreground">Create subjects, chapters, materials, and MCQs for learners.</p>
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
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Chapter</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Chapter title" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={topicSubjectId} onChange={(e) => setTopicSubjectId(Number(e.target.value))} required>
                <option value="">Select subject</option>
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                ))}
              </select>
              <Button type="submit" className="w-full">Save Chapter</Button>
            </form>

            <form onSubmit={onCreateMaterial} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Create Material</h2>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Material title" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={materialType} onChange={(e) => setMaterialType(e.target.value as "notes" | "past_paper")}>
                <option value="notes">Notes</option>
                <option value="past_paper">Past Paper</option>
              </select>
              <select className="w-full border rounded-lg px-3 py-2" value={materialTopicId} onChange={(e) => setMaterialTopicId(Number(e.target.value))} required>
                <option value="">Select chapter</option>
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
                <option value="">Select chapter</option>
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
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Upload Multiple PDFs to a Chapter</h2>
              <select className="w-full border rounded-lg px-3 py-2" value={pdfTopicId} onChange={(e) => setPdfTopicId(Number(e.target.value))} required>
                <option value="">Select chapter</option>
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

            <section className="rounded-2xl border bg-white p-5 space-y-4 md:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><Layers className="h-4 w-4" /> Manage Existing Subjects, Chapters, and Materials</h2>
              <p className="text-sm text-muted-foreground">Use this panel to remove subjects, chapters, and materials. Deleting a subject deletes all nested data.</p>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Filter by Subject</label>
                  <select className="w-full border rounded-lg px-3 py-2" value={manageSubjectId} onChange={(e) => setManageSubjectId(e.target.value ? Number(e.target.value) : "") }>
                    <option value="">All subjects</option>
                    {sortedSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name} ({subject.exam_type})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Show Materials for Chapter</label>
                  <select className="w-full border rounded-lg px-3 py-2" value={manageTopicId} onChange={(e) => setManageTopicId(e.target.value ? Number(e.target.value) : "") }>
                    <option value="">Select chapter</option>
                    {manageSubjectTopics.map((topic) => (
                      <option key={topic.id} value={topic.id}>{topic.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 font-medium">Subjects</h3>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {(manageSubjectId ? sortedSubjects.filter((subject) => subject.id === manageSubjectId) : sortedSubjects).map((subject) => (
                      <div key={subject.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          {editSubjectId === subject.id ? (
                            <form onSubmit={e => { e.preventDefault(); onSaveEditSubject(subject); }} className="flex gap-2 items-center">
                              <input
                                className="border rounded px-2 py-1 text-sm w-32"
                                value={editSubjectName}
                                onChange={e => setEditSubjectName(e.target.value)}
                                disabled={actionBusy === `edit-subject-${subject.id}`}
                                autoFocus
                              />
                              <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-subject-${subject.id}`}>Save</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditSubjectId(null)}>Cancel</Button>
                            </form>
                          ) : (
                            <>
                              <p className="text-sm font-medium">{subject.name}</p>
                              <p className="text-xs text-muted-foreground">{subject.exam_type}</p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditSubject(subject)}
                            disabled={editSubjectId !== null || !!actionBusy}
                            title="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionBusy === `subject-${subject.id}`}
                            onClick={() => onDeleteSubject(subject.id, subject.name)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 font-medium">Chapters</h3>
                  <div className="max-h-56 space-y-2 overflow-auto pr-1">
                    {manageSubjectTopics.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No chapters found for selected subject.</p>
                    ) : (
                      manageSubjectTopics.map((topic) => (
                        <div key={topic.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          {editTopicId === topic.id ? (
                            <form onSubmit={e => { e.preventDefault(); onSaveEditTopic(topic); }} className="flex gap-2 items-center w-full">
                              <input
                                className="border rounded px-2 py-1 text-sm w-32"
                                value={editTopicTitle}
                                onChange={e => setEditTopicTitle(e.target.value)}
                                disabled={actionBusy === `edit-topic-${topic.id}`}
                                autoFocus
                              />
                              <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-topic-${topic.id}`}>Save</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditTopicId(null)}>Cancel</Button>
                            </form>
                          ) : (
                            <p className="text-sm font-medium">{topic.title}</p>
                          )}
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditTopic(topic)}
                              disabled={editTopicId !== null || !!actionBusy}
                              title="Rename"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={actionBusy === `topic-${topic.id}`}
                              onClick={() => onDeleteTopic(topic.id, topic.title)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 flex items-center gap-2 font-medium"><FolderOpen className="h-4 w-4" /> Materials in Selected Chapter</h3>
                {!manageTopicId ? (
                  <p className="text-xs text-muted-foreground">Select a chapter above to manage its materials.</p>
                ) : topicMaterials.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No materials found for this chapter.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {topicMaterials.map((material) => (
                      <div key={material.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          {editMaterialId === material.id ? (
                            <form onSubmit={e => { e.preventDefault(); onSaveEditMaterial(material); }} className="flex gap-2 items-center">
                              <input
                                className="border rounded px-2 py-1 text-sm w-32"
                                value={editMaterialTitle}
                                onChange={e => setEditMaterialTitle(e.target.value)}
                                disabled={actionBusy === `edit-material-${material.id}`}
                                autoFocus
                              />
                              <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-material-${material.id}`}>Save</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditMaterialId(null)}>Cancel</Button>
                            </form>
                          ) : (
                            <>
                              <p className="text-sm font-medium">{material.title}</p>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{material.type}</p>
                            </>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditMaterial(material)}
                            disabled={editMaterialId !== null || !!actionBusy}
                            title="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={actionBusy === `material-${material.id}`}
                            onClick={() => onDeleteMaterial(material.id, material.title)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminContent;

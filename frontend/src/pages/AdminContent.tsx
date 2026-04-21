import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { PlusCircle, Trash2, Layers, FolderOpen, Pencil, Upload, Shield, Crown, Users, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient, Material, Note, Resource, Subject, Topic, type UserAdminView } from "@/services/api";

const AdminContent = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
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

  // Resource form
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceChapterId, setResourceChapterId] = useState<number | "">("");

  // Note form
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSubjectId, setNoteSubjectId] = useState<number | "">("");
  const [noteChapterId, setNoteChapterId] = useState<number | "">("");

  // MCQ CSV upload form
  const [csvExamType, setCsvExamType] = useState("ALL");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Essay CSV upload form
  const [essayCsvFile, setEssayCsvFile] = useState<File | null>(null);

  // Past paper (new table) form
  const [paperSubjectId, setPaperSubjectId] = useState<number | "">("");
  const [paperChapterId, setPaperChapterId] = useState<number | "">("");
  const [paperTitle, setPaperTitle] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [paperFile, setPaperFile] = useState<File | null>(null);

  // Manage: resources and notes for selected chapter/subject
  const [chapterResources, setChapterResources] = useState<Resource[]>([]);
  const [subjectNotesList, setSubjectNotesList] = useState<Note[]>([]);
  const [chapterNotesList, setChapterNotesList] = useState<Note[]>([]);

  // ── User management state ──
  const [allUsers, setAllUsers] = useState<UserAdminView[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [togglingPro, setTogglingPro] = useState<string | null>(null);

  // ── Grant Pro by Email state ──
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [grantLoading, setGrantLoading] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q)
    );
  }, [allUsers, userSearch]);

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

    const allTopics = await apiClient.listAllTopics();
    setTopics(allTopics);

    // Load user list for pro management
    if (profile.is_admin) {
      apiClient.listAllUsers().then(setAllUsers).catch(() => {});
    }
  };

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        await loadData();
      } catch (error: any) {
        // If auth error, clear token and redirect to login
        const msg: string = (error?.message || "").toLowerCase();
        if (
          msg.includes("401") ||
          msg.includes("unauthorized") ||
          msg.includes("invalid authentication") ||
          msg.includes("not authenticated")
        ) {
          apiClient.clearToken();
          navigate("/login", { replace: true, state: { reason: "session-expired" } });
          return;
        }
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
        setChapterResources([]);
        setChapterNotesList([]);
        return;
      }
      try {
        const [materials, resources, notes] = await Promise.all([
          apiClient.listMaterials(manageTopicId),
          apiClient.listChapterResources(manageTopicId),
          apiClient.listChapterNotes(manageTopicId),
        ]);
        setTopicMaterials(materials);
        setChapterResources(resources);
        setChapterNotesList(notes);
      } catch {
        setTopicMaterials([]);
        setChapterResources([]);
        setChapterNotesList([]);
      }
    })();
  }, [manageTopicId]);

  useEffect(() => {
    (async () => {
      if (!manageSubjectId) { setSubjectNotesList([]); return; }
      try {
        const notes = await apiClient.listSubjectNotes(manageSubjectId);
        setSubjectNotesList(notes);
      } catch {
        setSubjectNotesList([]);
      }
    })();
  }, [manageSubjectId]);

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

  const onCreateResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!resourceChapterId) return;
    try {
      await apiClient.createResource({
        title: resourceTitle.trim(),
        url: resourceUrl.trim(),
        chapter_id: resourceChapterId,
      });
      setResourceTitle("");
      setResourceUrl("");
      if (manageTopicId === resourceChapterId) {
        const refreshed = await apiClient.listChapterResources(resourceChapterId);
        setChapterResources(refreshed);
      }
      toast({ description: "Resource link added" });
    } catch (error: any) {
      toast({ title: "Add resource failed", description: error.message, variant: "destructive" });
    }
  };

  const onDeleteResource = async (resourceId: number, label: string) => {
    if (!window.confirm(`Delete resource "${label}"?`)) return;
    setActionBusy(`resource-${resourceId}`);
    try {
      await apiClient.deleteResource(resourceId);
      if (manageTopicId) {
        const refreshed = await apiClient.listChapterResources(manageTopicId);
        setChapterResources(refreshed);
      }
      toast({ description: "Resource deleted" });
    } catch (error: any) {
      toast({ title: "Delete resource failed", description: error.message, variant: "destructive" });
    } finally {
      setActionBusy(null);
    }
  };

  const onCreateNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteSubjectId && !noteChapterId) {
      toast({ title: "Select a subject or chapter for the note", variant: "destructive" });
      return;
    }
    try {
      await apiClient.createNote({
        title: noteTitle.trim(),
        content: noteContent.trim(),
        subject_id: noteSubjectId || undefined,
        chapter_id: noteChapterId || undefined,
      });
      setNoteTitle("");
      setNoteContent("");
      if (manageSubjectId && noteSubjectId === manageSubjectId) {
        const refreshed = await apiClient.listSubjectNotes(manageSubjectId);
        setSubjectNotesList(refreshed);
      }
      if (manageTopicId && noteChapterId === manageTopicId) {
        const refreshed = await apiClient.listChapterNotes(manageTopicId);
        setChapterNotesList(refreshed);
      }
      toast({ description: "Note added" });
    } catch (error: any) {
      toast({ title: "Add note failed", description: error.message, variant: "destructive" });
    }
  };

  const onDeleteNote = async (noteId: number, label: string) => {
    if (!window.confirm(`Delete note "${label}"?`)) return;
    setActionBusy(`note-${noteId}`);
    try {
      await apiClient.deleteNote(noteId);
      if (manageSubjectId) {
        const refreshed = await apiClient.listSubjectNotes(manageSubjectId);
        setSubjectNotesList(refreshed);
      }
      if (manageTopicId) {
        const refreshed = await apiClient.listChapterNotes(manageTopicId);
        setChapterNotesList(refreshed);
      }
      toast({ description: "Note deleted" });
    } catch (error: any) {
      toast({ title: "Delete note failed", description: error.message, variant: "destructive" });
    } finally {
      setActionBusy(null);
    }
  };

  const onUploadMCQCSV = async (e: FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    try {
      const result = await apiClient.uploadMCQCSV(csvFile, csvExamType);
      setCsvFile(null);
      toast({
        description: `MCQ CSV imported: ${result.created} created, ${result.skipped} skipped (${result.total_rows} total rows)`,
      });
    } catch (error: any) {
      toast({ title: "CSV upload failed", description: error.message, variant: "destructive" });
    }
  };

  const onUploadEssayCSV = async (e: FormEvent) => {
    e.preventDefault();
    if (!essayCsvFile) return;
    try {
      const result = await apiClient.uploadEssayCSV(essayCsvFile);
      setEssayCsvFile(null);
      toast({
        description: `Essay CSV imported: ${result.created} created, ${result.skipped} skipped (${result.total_rows} total rows)`,
      });
    } catch (error: any) {
      toast({ title: "Essay CSV upload failed", description: error.message, variant: "destructive" });
    }
  };

  const onCreatePaper = async (e: FormEvent) => {
    e.preventDefault();
    if (!paperSubjectId || !paperTitle.trim()) return;
    try {
      await apiClient.createPaper({
        subject_id: paperSubjectId,
        title: paperTitle.trim(),
        chapter_id: paperChapterId || undefined,
        url: paperUrl.trim() || undefined,
        file: paperFile || undefined,
      });
      setPaperTitle("");
      setPaperUrl("");
      setPaperFile(null);
      toast({ description: "Past paper added" });
    } catch (error: any) {
      toast({ title: "Add past paper failed", description: error.message, variant: "destructive" });
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

  const toggleProStatus = async (user: UserAdminView) => {
    setTogglingPro(user.id);
    try {
      const updated = await apiClient.setUserProStatus(user.id, !user.is_pro);
      setAllUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      toast({ description: `${user.email} is now ${updated.is_pro ? "Pro" : "Free"}` });
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally { setTogglingPro(null); }
  };

  const handleGrantProByEmail = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = grantEmail.trim();
    if (!trimmed || grantLoading) return;
    setGrantLoading(true);
    try {
      const res = await apiClient.grantProByEmail(trimmed, grantDays);
      toast({ description: res.message });
      setGrantEmail("");
      setGrantDays(30);
      // refresh user list
      try { setAllUsers(await apiClient.listAllUsers()); } catch { /* ignore */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to grant pro";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setGrantLoading(false); }
  };

  const handleRevokeProByEmail = async () => {
    const trimmed = grantEmail.trim();
    if (!trimmed || grantLoading) return;
    setGrantLoading(true);
    try {
      const res = await apiClient.revokeProByEmail(trimmed);
      toast({ description: res.message });
      setGrantEmail("");
      try { setAllUsers(await apiClient.listAllUsers()); } catch { /* ignore */ }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to revoke pro";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setGrantLoading(false); }
  };

  if (!apiClient.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!loading && !isAdmin) {
    return <Navigate to="/" replace />;
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
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add Tips &amp; Tricks</h2>
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

            {/* ── Resource Links ── */}
            <form onSubmit={onCreateResource} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add Resource Link to Chapter</h2>
              <p className="text-xs text-muted-foreground">Add Google Drive links, external URLs, or any resource URL to a chapter.</p>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Resource title (e.g. Chapter 1 Drive Notes)" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} required />
              <input className="w-full border rounded-lg px-3 py-2" placeholder="URL (https://...)" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={resourceChapterId} onChange={(e) => setResourceChapterId(Number(e.target.value))} required>
                <option value="">Select chapter</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <Button type="submit" className="w-full">Save Resource Link</Button>
            </form>

            {/* ── Notes ── */}
            <form onSubmit={onCreateNote} className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add Note</h2>
              <p className="text-xs text-muted-foreground">Link to a subject (appears in right column) or a chapter (appears in chapter accordion). At least one is required.</p>
              <input className="w-full border rounded-lg px-3 py-2" placeholder="Note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} required />
              <textarea className="w-full border rounded-lg px-3 py-2 min-h-24" placeholder="Note content (text or URL)" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} required />
              <select className="w-full border rounded-lg px-3 py-2" value={noteSubjectId} onChange={(e) => setNoteSubjectId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Subject (optional) —</option>
                {sortedSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                ))}
              </select>
              <select className="w-full border rounded-lg px-3 py-2" value={noteChapterId} onChange={(e) => setNoteChapterId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">— Chapter (optional) —</option>
                {sortedTopics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <Button type="submit" className="w-full">Save Note</Button>
            </form>

            {/* ── MCQ CSV Upload ── */}
            <form onSubmit={onUploadMCQCSV} className="rounded-2xl border bg-white p-5 space-y-3 md:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk Upload MCQs via CSV</h2>
              <p className="text-xs text-muted-foreground">
                CSV must have columns: <code className="bg-slate-100 px-1 rounded text-[11px]">question, option1, option2, option3, option4, correct_answer, subject, chapter</code> (and optional <code className="bg-slate-100 px-1 rounded text-[11px]">explanation</code>).
                Correct answer must be A, B, C, or D. Subjects and chapters are auto-created if they don't exist.
                Column name aliases are supported (e.g. <code className="bg-slate-100 px-1 rounded text-[11px]">sentence</code> → question, <code className="bg-slate-100 px-1 rounded text-[11px]">topic</code> → chapter, <code className="bg-slate-100 px-1 rounded text-[11px]">answer</code> → correct_answer).
              </p>
              <select className="w-full border rounded-lg px-3 py-2" value={csvExamType} onChange={(e) => setCsvExamType(e.target.value)} required>
                <option value="ALL">ALL Categories (add to every category)</option>
                <option value="USAT-E">USAT-E (Pre-Engineering)</option>
                <option value="USAT-M">USAT-M (Pre-Medical)</option>
                <option value="USAT-CS">USAT-CS (Computer Science)</option>
                <option value="USAT-GS">USAT-GS (General Science)</option>
                <option value="USAT-A">USAT-A (Arts & Humanities)</option>
              </select>
              <input
                className="w-full border rounded-lg px-3 py-2"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCsvFile((e.target.files && e.target.files[0]) || null)}
                required
              />
              {csvFile && <p className="text-sm text-muted-foreground">{csvFile.name}</p>}
              <Button type="submit" className="w-full" disabled={!csvFile}>Upload MCQ CSV</Button>
            </form>

            {/* ── Essay CSV Upload ── */}
            <form onSubmit={onUploadEssayCSV} className="rounded-2xl border bg-white p-5 space-y-3 md:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk Upload Essay Prompts via CSV</h2>
              <p className="text-xs text-muted-foreground">
                CSV must have columns: <code className="bg-slate-100 px-1 rounded text-[11px]">essay_type, prompt_text</code> (and optional <code className="bg-slate-100 px-1 rounded text-[11px]">exam_type</code>).
                essay_type must be <code className="bg-slate-100 px-1 rounded text-[11px]">argumentative</code> or <code className="bg-slate-100 px-1 rounded text-[11px]">narrative</code>. Leave exam_type blank for prompts shared across all categories.
              </p>
              <input
                className="w-full border rounded-lg px-3 py-2"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setEssayCsvFile((e.target.files && e.target.files[0]) || null)}
                required
              />
              {essayCsvFile && <p className="text-sm text-muted-foreground">{essayCsvFile.name}</p>}
              <Button type="submit" className="w-full" disabled={!essayCsvFile}>Upload Essay CSV</Button>
            </form>

            {/* ── Past Papers (new dedicated table) ── */}
            <form onSubmit={onCreatePaper} className="rounded-2xl border bg-white p-5 space-y-3 md:col-span-2">
              <h2 className="font-semibold flex items-center gap-2"><PlusCircle className="h-4 w-4" /> Add Past Paper (New System)</h2>
              <p className="text-xs text-muted-foreground">Stored in the dedicated past-papers table. Appears under subject's Past Papers panel. Chapter is optional.</p>
              <div className="grid md:grid-cols-2 gap-3">
                <select className="w-full border rounded-lg px-3 py-2" value={paperSubjectId} onChange={(e) => setPaperSubjectId(Number(e.target.value))} required>
                  <option value="">Select subject *</option>
                  {sortedSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>
                  ))}
                </select>
                <select className="w-full border rounded-lg px-3 py-2" value={paperChapterId} onChange={(e) => setPaperChapterId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">— Chapter (optional) —</option>
                  {sortedTopics.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <input className="w-full border rounded-lg px-3 py-2" placeholder="Paper title (e.g. Physics 2024)" value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)} required />
                <input className="w-full border rounded-lg px-3 py-2" placeholder="External URL (optional if uploading file)" value={paperUrl} onChange={(e) => setPaperUrl(e.target.value)} />
              </div>
              <input className="w-full border rounded-lg px-3 py-2" type="file" accept="application/pdf" onChange={(e) => setPaperFile((e.target.files && e.target.files[0]) || null)} />
              {paperFile && <p className="text-sm text-muted-foreground">{paperFile.name}</p>}
              <Button type="submit" className="w-full">Save Past Paper</Button>
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

              {/* ── Resource Links in Selected Chapter ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 flex items-center gap-2 font-medium"><FolderOpen className="h-4 w-4" /> Resource Links in Selected Chapter</h3>
                {!manageTopicId ? (
                  <p className="text-xs text-muted-foreground">Select a chapter above.</p>
                ) : chapterResources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No resource links for this chapter.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {chapterResources.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{r.title}</p>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 truncate block">{r.url}</a>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionBusy === `resource-${r.id}`}
                          onClick={() => onDeleteResource(r.id, r.title)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Chapter Notes ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 flex items-center gap-2 font-medium"><FolderOpen className="h-4 w-4" /> Notes in Selected Chapter</h3>
                {!manageTopicId ? (
                  <p className="text-xs text-muted-foreground">Select a chapter above.</p>
                ) : chapterNotesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No chapter-level notes.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {chapterNotesList.map((n) => (
                      <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionBusy === `note-${n.id}`}
                          onClick={() => onDeleteNote(n.id, n.title)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Subject Notes ── */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="mb-2 flex items-center gap-2 font-medium"><FolderOpen className="h-4 w-4" /> Notes for Selected Subject</h3>
                {!manageSubjectId ? (
                  <p className="text-xs text-muted-foreground">Select a subject above.</p>
                ) : subjectNotesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No subject-level notes.</p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-auto pr-1">
                    {subjectNotesList.map((n) => (
                      <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={actionBusy === `note-${n.id}`}
                          onClick={() => onDeleteNote(n.id, n.title)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ═══════════════════════════════ GRANT PRO BY EMAIL ═══════════════════════════════ */}
          {isAdmin && (
            <section className="mt-10 rounded-2xl border-2 border-blue-300 bg-gradient-to-br from-white to-blue-50/40 p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-blue-600" />
                  <h2 className="text-xl font-bold">Grant Pro Access</h2>
                  <span className="rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">Admin Only</span>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">Grant or revoke Pro subscription by entering the user's email address.</p>
                <form onSubmit={handleGrantProByEmail} className="flex flex-col sm:flex-row gap-3">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition"
                    type="email"
                    placeholder="Enter user email"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent transition"
                    type="number"
                    min={1}
                    max={3650}
                    placeholder="Days"
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value) || 30)}
                  />
                  <Button
                    type="submit"
                    disabled={grantLoading || !grantEmail.trim()}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
                  >
                    {grantLoading ? "Processing..." : "Grant Pro"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={grantLoading || !grantEmail.trim()}
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={handleRevokeProByEmail}
                  >
                    {grantLoading ? "..." : "Revoke Pro"}
                  </Button>
                </form>
            </section>
          )}

          {/* ═══════════════════════════════ USER / PRO MANAGEMENT ═══════════════════════════════ */}
          <section className="mt-10 rounded-2xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50/40 p-6 shadow-sm">
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                <h2 className="text-xl font-bold">User Management</h2>
                <span className="ml-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">{allUsers.length} users</span>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent transition"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
            </div>

            {allUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3 text-center">Role</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="bg-white hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-700">{u.full_name || "—"}</span>
                            <span className="text-xs text-slate-400">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.is_admin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                              <Shield className="h-3 w-3" /> Admin
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">User</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.is_admin ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-100 to-blue-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                              <Crown className="h-3 w-3" /> Pro (Admin)
                            </span>
                          ) : u.is_pro ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-100 to-cyan-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                              <Crown className="h-3 w-3" /> Pro
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Free</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {u.is_admin ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <Button
                              size="sm"
                              variant={u.is_pro ? "outline" : "default"}
                              className={u.is_pro
                                ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
                              }
                              disabled={togglingPro === u.id}
                              onClick={() => toggleProStatus(u)}
                            >
                              {togglingPro === u.id ? "..." : u.is_pro ? "Revoke Pro" : "Grant Pro"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  );
};

export default AdminContent;

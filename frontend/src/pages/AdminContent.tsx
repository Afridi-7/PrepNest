import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  PlusCircle, Trash2, Layers, FolderOpen, Pencil, Upload, Shield, Crown, Users, Search,
  BarChart2, ChevronDown, ChevronRight, BookOpen, Wrench, FileText, Settings,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient, Material, MCQ, Note, Resource, Subject, Topic, type UserAdminView } from "@/services/api";

type Tab = "content" | "mcqs" | "upload" | "users" | "tools";
interface MCQStat { subject: string; chapter: string; mcqs: number; }
const EXAM_TYPES = ["USAT-E", "USAT-M", "USAT-CS", "USAT-GS", "USAT-A"];

const AdminContent = () => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("content");
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
  const [tipSubjectId, setTipSubjectId] = useState<number | "">("");
  const [tipTitle, setTipTitle] = useState("");
  const [tipContent, setTipContent] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceChapterId, setResourceChapterId] = useState<number | "">("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSubjectId, setNoteSubjectId] = useState<number | "">("");
  const [noteChapterId, setNoteChapterId] = useState<number | "">("");
  const [pastPaperSubjectId, setPastPaperSubjectId] = useState<number | "">("");
  const [pastPaperYear, setPastPaperYear] = useState<number>(2025);
  const [pastPaperTitle, setPastPaperTitle] = useState("");
  const [pastPaperContent, setPastPaperContent] = useState("");
  const [pastPaperFile, setPastPaperFile] = useState<File | null>(null);
  const [paperSubjectId, setPaperSubjectId] = useState<number | "">("");
  const [paperChapterId, setPaperChapterId] = useState<number | "">("");
  const [paperTitle, setPaperTitle] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [pdfTopicId, setPdfTopicId] = useState<number | "">("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [csvExamType, setCsvExamType] = useState("ALL");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);
  const [essayCsvFile, setEssayCsvFile] = useState<File | null>(null);
  const [isUploadingEssayCSV, setIsUploadingEssayCSV] = useState(false);
  const [manageSubjectId, setManageSubjectId] = useState<number | "">("");
  const [manageTopicId, setManageTopicId] = useState<number | "">("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [editSubjectId, setEditSubjectId] = useState<number | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editTopicId, setEditTopicId] = useState<number | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editMaterialId, setEditMaterialId] = useState<number | null>(null);
  const [editMaterialTitle, setEditMaterialTitle] = useState("");
  const [chapterResources, setChapterResources] = useState<Resource[]>([]);
  const [subjectNotesList, setSubjectNotesList] = useState<Note[]>([]);
  const [chapterNotesList, setChapterNotesList] = useState<Note[]>([]);

  const [mcqStats, setMcqStats] = useState<MCQStat[]>([]);
  const [mcqStatsLoading, setMcqStatsLoading] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [chapterMCQs, setChapterMCQs] = useState<Record<string, MCQ[]>>({});
  const [chapterMCQsLoading, setChapterMCQsLoading] = useState<Set<string>>(new Set());
  const [mcqFilterExamType, setMcqFilterExamType] = useState<string>("all");
  const [deletingChapterMCQs, setDeletingChapterMCQs] = useState<string | null>(null);
  const [deletingMCQ, setDeletingMCQ] = useState<number | null>(null);

  const [allUsers, setAllUsers] = useState<UserAdminView[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [togglingPro, setTogglingPro] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [grantLoading, setGrantLoading] = useState(false);
  const [purgeSubjectName, setPurgeSubjectName] = useState("");

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return allUsers;
    const q = userSearch.toLowerCase();
    return allUsers.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [allUsers, userSearch]);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  );
  const sortedTopics = useMemo(
    () => [...topics].sort((a, b) => a.title.localeCompare(b.title)),
    [topics],
  );
  const manageSubjectTopics = useMemo(
    () => sortedTopics.filter((t) => (manageSubjectId ? t.subject_id === manageSubjectId : true)),
    [sortedTopics, manageSubjectId],
  );

  const mcqStatsByExamType = useMemo(() => {
    const subjectExamMap: Record<string, string> = {};
    subjects.forEach((s) => { subjectExamMap[s.name] = s.exam_type; });
    const grouped: Record<string, Record<string, { total: number; chapters: { chapter: string; mcqs: number; topic: Topic | undefined }[] }>> = {};
    mcqStats.forEach(({ subject, chapter, mcqs }) => {
      const et = subjectExamMap[subject] || "Unknown";
      if (!grouped[et]) grouped[et] = {};
      if (!grouped[et][subject]) grouped[et][subject] = { total: 0, chapters: [] };
      grouped[et][subject].total += mcqs;
      const topic = topics.find(
        (t) => t.title === chapter && subjects.find((s) => s.name === subject && s.id === t.subject_id),
      );
      grouped[et][subject].chapters.push({ chapter, mcqs, topic });
    });
    return grouped;
  }, [mcqStats, subjects, topics]);

  const filteredMcqStats = useMemo(() => {
    if (mcqFilterExamType === "all") return mcqStatsByExamType;
    return Object.fromEntries(
      Object.entries(mcqStatsByExamType).filter(([et]) => et === mcqFilterExamType),
    );
  }, [mcqStatsByExamType, mcqFilterExamType]);

  const totalMCQs = useMemo(() => mcqStats.reduce((sum, s) => sum + s.mcqs, 0), [mcqStats]);

  const loadData = async () => {
    const profile = await apiClient.getCurrentUser();
    setIsAdmin(profile.is_admin);
    const [fetchedSubjects, allTopics] = await Promise.all([
      apiClient.listSubjects(),
      apiClient.listAllTopics(),
    ]);
    setSubjects(fetchedSubjects);
    setTopics(allTopics);
    if (profile.is_admin) {
      apiClient.listAllUsers().then(setAllUsers).catch(() => {});
    }
  };

  const loadMCQStats = useCallback(async () => {
    setMcqStatsLoading(true);
    try {
      const stats = await apiClient.getMCQStats();
      setMcqStats(stats);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      toast({ title: "Failed to load MCQ stats", description: msg, variant: "destructive" });
    } finally {
      setMcqStatsLoading(false);
    }
  }, [toast]);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        await loadData();
      } catch (error: unknown) {
        const msg = (error instanceof Error ? error.message : "").toLowerCase();
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
        toast({
          title: "Failed to load admin data",
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === "mcqs" && mcqStats.length === 0 && !mcqStatsLoading) {
      loadMCQStats();
    }
  }, [activeTab]);

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
      } catch { setSubjectNotesList([]); }
    })();
  }, [manageSubjectId]);

  const toggleExpandSubject = (key: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleExpandChapter = async (chapterKey: string, topicId: number | undefined) => {
    const willExpand = !expandedChapters.has(chapterKey);
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterKey)) next.delete(chapterKey);
      else next.add(chapterKey);
      return next;
    });
    if (willExpand && topicId && !chapterMCQs[chapterKey]) {
      setChapterMCQsLoading((prev) => new Set(prev).add(chapterKey));
      try {
        const mcqs = await apiClient.getAdminMCQs(topicId);
        setChapterMCQs((prev) => ({ ...prev, [chapterKey]: mcqs }));
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast({ title: "Failed to load MCQs", description: msg, variant: "destructive" });
      } finally {
        setChapterMCQsLoading((prev) => {
          const next = new Set(prev);
          next.delete(chapterKey);
          return next;
        });
      }
    }
  };

  const onDeleteSingleMCQ = async (mcqId: number, chapterKey: string, chapterName: string, subjectName: string) => {
    if (!window.confirm("Delete this MCQ?")) return;
    setDeletingMCQ(mcqId);
    try {
      await apiClient.deleteMCQ(mcqId);
      setChapterMCQs((prev) => ({
        ...prev,
        [chapterKey]: (prev[chapterKey] || []).filter((m) => m.id !== mcqId),
      }));
      setMcqStats((prev) =>
        prev.map((s) =>
          s.chapter === chapterName && s.subject === subjectName
            ? { ...s, mcqs: Math.max(0, s.mcqs - 1) }
            : s,
        ),
      );
      toast({ description: "MCQ deleted" });
    } catch (error: unknown) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    } finally {
      setDeletingMCQ(null);
    }
  };

  const onDeleteAllChapterMCQs = async (chapterKey: string, topicId: number | undefined, chapterTitle: string) => {
    if (!topicId) return;
    if (!window.confirm(`Delete ALL MCQs in chapter "${chapterTitle}"? This cannot be undone.`)) return;
    setDeletingChapterMCQs(chapterKey);
    try {
      const result = await apiClient.deleteTopicMCQs(topicId);
      setChapterMCQs((prev) => ({ ...prev, [chapterKey]: [] }));
      setMcqStats((prev) =>
        prev.map((s) => (s.chapter === chapterTitle ? { ...s, mcqs: 0 } : s)),
      );
      toast({ description: `Deleted ${result.deleted} MCQs from "${chapterTitle}"` });
    } catch (error: unknown) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    } finally {
      setDeletingChapterMCQs(null);
    }
  };

  const onCreateSubject = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createSubject({ name: subjectName.trim(), exam_type: examType.trim() });
      setSubjectName("");
      await loadData();
      toast({ description: "Subject created" });
    } catch (error: unknown) {
      toast({ title: "Create subject failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
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
      toast({ description: "Chapter created" });
    } catch (error: unknown) {
      toast({ title: "Create chapter failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
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
    } catch (error: unknown) {
      toast({ title: "Create material failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
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
      setQuestion(""); setOptionA(""); setOptionB(""); setOptionC(""); setOptionD(""); setExplanation("");
      toast({ description: "MCQ created" });
    } catch (error: unknown) {
      toast({ title: "Create MCQ failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
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
    } catch (error: unknown) {
      toast({ title: "PDF upload failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
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
      setPastPaperTitle(""); setPastPaperContent(""); setPastPaperFile(null);
      toast({ description: "Past paper created" });
    } catch (error: unknown) {
      toast({ title: "Create past paper failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onCreateTip = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipSubjectId) return;
    try {
      await apiClient.createTip({ title: tipTitle.trim(), content: tipContent.trim(), subject_id: tipSubjectId });
      setTipTitle(""); setTipContent("");
      toast({ description: "Tip added" });
    } catch (error: unknown) {
      toast({ title: "Create tip failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onCreateResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!resourceChapterId) return;
    try {
      await apiClient.createResource({ title: resourceTitle.trim(), url: resourceUrl.trim(), chapter_id: resourceChapterId });
      setResourceTitle(""); setResourceUrl("");
      if (manageTopicId === resourceChapterId) {
        const refreshed = await apiClient.listChapterResources(resourceChapterId);
        setChapterResources(refreshed);
      }
      toast({ description: "Resource link added" });
    } catch (error: unknown) {
      toast({ title: "Add resource failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
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
    } catch (error: unknown) {
      toast({ title: "Delete resource failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    } finally { setActionBusy(null); }
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
      setNoteTitle(""); setNoteContent("");
      if (manageSubjectId && noteSubjectId === manageSubjectId) {
        const refreshed = await apiClient.listSubjectNotes(manageSubjectId);
        setSubjectNotesList(refreshed);
      }
      if (manageTopicId && noteChapterId === manageTopicId) {
        const refreshed = await apiClient.listChapterNotes(manageTopicId);
        setChapterNotesList(refreshed);
      }
      toast({ description: "Note added" });
    } catch (error: unknown) {
      toast({ title: "Add note failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
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
    } catch (error: unknown) {
      toast({ title: "Delete note failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    } finally { setActionBusy(null); }
  };

  const onUploadMCQCSV = async (e: FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;
    setIsUploadingCSV(true);
    try {
      const result = await apiClient.uploadMCQCSV(csvFile, csvExamType);
      setCsvFile(null);
      toast({ description: `MCQ CSV imported: ${result.created} created, ${result.skipped} skipped (${result.total_rows} total rows)` });
      if (activeTab === "mcqs") loadMCQStats();
    } catch (error: unknown) {
      toast({ title: "CSV upload failed", description: error instanceof Error ? error.message : "Unknown error occurred", variant: "destructive" });
    } finally {
      setIsUploadingCSV(false);
    }
  };

  const onUploadEssayCSV = async (e: FormEvent) => {
    e.preventDefault();
    if (!essayCsvFile) return;
    setIsUploadingEssayCSV(true);
    try {
      const result = await apiClient.uploadEssayCSV(essayCsvFile);
      setEssayCsvFile(null);
      toast({ description: `Essay CSV imported: ${result.created} created, ${result.skipped} skipped (${result.total_rows} total rows)` });
    } catch (error: unknown) {
      toast({ title: "Essay CSV upload failed", description: error instanceof Error ? error.message : "Unknown error occurred", variant: "destructive" });
    } finally {
      setIsUploadingEssayCSV(false);
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
      setPaperTitle(""); setPaperUrl(""); setPaperFile(null);
      toast({ description: "Past paper added" });
    } catch (error: unknown) {
      toast({ title: "Add past paper failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onDedupeSubjects = async () => {
    try {
      const result = await apiClient.dedupeSubjects();
      await loadData();
      toast({ description: `Removed ${result.removed_subjects} duplicate subjects, merged ${result.merged_topics} topics, moved ${result.moved_materials} materials, ${result.moved_mcqs} MCQs` });
    } catch (error: unknown) {
      toast({ title: "Dedupe failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onPurgePlaceholderMCQs = async () => {
    if (!window.confirm("Delete all auto-generated placeholder MCQs? This cannot be undone.")) return;
    try {
      const result = await apiClient.purgePlaceholderMCQs();
      toast({ description: `Deleted ${result.deleted} placeholder MCQs.` });
      if (activeTab === "mcqs") loadMCQStats();
    } catch (error: unknown) {
      toast({ title: "Purge failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onPurgeQuantitativeMCQs = async () => {
    if (!window.confirm("Delete ALL MCQs under every Quantitative Reasoning subject? This cannot be undone.")) return;
    try {
      const result = await apiClient.purgeSubjectMCQs("Quantitative Reasoning");
      toast({ description: `Deleted ${result.deleted} MCQs from ${result.subjects} subject(s) / ${result.topics} chapter(s).` });
      if (activeTab === "mcqs") loadMCQStats();
    } catch (error: unknown) {
      toast({ title: "Purge failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onPurgeBySubjectName = async () => {
    if (!purgeSubjectName.trim()) return;
    if (!window.confirm(`Delete ALL MCQs under every subject named "${purgeSubjectName.trim()}"? This cannot be undone.`)) return;
    try {
      const result = await apiClient.purgeSubjectMCQs(purgeSubjectName.trim());
      setPurgeSubjectName("");
      toast({ description: `Deleted ${result.deleted} MCQs from ${result.subjects} subject(s) / ${result.topics} chapter(s).` });
      if (activeTab === "mcqs") loadMCQStats();
    } catch (error: unknown) {
      toast({ title: "Purge failed", description: error instanceof Error ? error.message : "Unknown", variant: "destructive" });
    }
  };

  const onEditSubject = (subject: Subject) => { setEditSubjectId(subject.id); setEditSubjectName(subject.name); };
  const onSaveEditSubject = async (subject: Subject) => {
    setActionBusy(`edit-subject-${subject.id}`);
    try {
      await apiClient.updateSubject(subject.id, { name: editSubjectName });
      setEditSubjectId(null);
      await loadData();
      toast({ description: "Subject renamed" });
    } catch (error: unknown) {
      toast({ title: "Rename failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      await loadData();
    } finally { setActionBusy(null); }
  };

  const onEditTopic = (topic: Topic) => { setEditTopicId(topic.id); setEditTopicTitle(topic.title); };
  const onSaveEditTopic = async (topic: Topic) => {
    setActionBusy(`edit-topic-${topic.id}`);
    try {
      await apiClient.updateTopic(topic.id, { title: editTopicTitle });
      setEditTopicId(null);
      await loadData();
      toast({ description: "Chapter renamed" });
    } catch (error: unknown) {
      toast({ title: "Rename failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      await loadData();
    } finally { setActionBusy(null); }
  };

  const onEditMaterial = (material: Material) => { setEditMaterialId(material.id); setEditMaterialTitle(material.title); };
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
    } catch (error: unknown) {
      toast({ title: "Rename failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setActionBusy(null); }
  };

  const onDeleteSubject = async (subjectId: number, subjectLabel: string) => {
    if (!window.confirm(`Delete subject "${subjectLabel}" and all its chapters/materials/MCQs?`)) return;
    setActionBusy(`subject-${subjectId}`);
    try {
      await apiClient.deleteSubject(subjectId);
      if (manageSubjectId === subjectId) setManageSubjectId("");
      await loadData();
      toast({ description: "Subject deleted" });
    } catch (error: unknown) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      await loadData();
    } finally { setActionBusy(null); }
  };

  const onDeleteTopic = async (topicId: number, topicLabel: string) => {
    if (!window.confirm(`Delete chapter "${topicLabel}" and all contained materials/MCQs?`)) return;
    setActionBusy(`topic-${topicId}`);
    try {
      await apiClient.deleteTopic(topicId);
      if (manageTopicId === topicId) setManageTopicId("");
      await loadData();
      toast({ description: "Chapter deleted" });
    } catch (error: unknown) {
      toast({ title: "Delete failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      await loadData();
    } finally { setActionBusy(null); }
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
    } catch (error: unknown) {
      toast({ title: "Delete material failed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setActionBusy(null); }
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
      setGrantEmail(""); setGrantDays(30);
      try { setAllUsers(await apiClient.listAllUsers()); } catch { /* ignore */ }
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to grant pro", variant: "destructive" });
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
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to revoke pro", variant: "destructive" });
    } finally { setGrantLoading(false); }
  };

  if (!apiClient.isAuthenticated()) return <Navigate to="/login" replace />;
  if (!loading && !isAdmin) return <Navigate to="/" replace />;

  const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "content", label: "Content", icon: <BookOpen className="h-4 w-4" /> },
    { id: "mcqs", label: "MCQ Manager", icon: <BarChart2 className="h-4 w-4" /> },
    { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "tools", label: "Tools", icon: <Wrench className="h-4 w-4" /> },
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-20 pb-16 px-4 bg-gradient-to-br from-slate-50 via-cyan-50/40 to-white">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 p-2.5 text-white shadow-md">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Admin Studio</h1>
                <p className="text-sm text-muted-foreground">Manage content, MCQs, and users</p>
              </div>
            </div>
          </div>

          <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TAB_CONFIG.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  activeTab === id
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {activeTab === "content" && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <form onSubmit={onCreateSubject} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> New Subject
                  </h2>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Subject name" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} required />
                  <div className="flex flex-wrap gap-1.5">
                    {EXAM_TYPES.map((et) => (
                      <button key={et} type="button" onClick={() => setExamType(et)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${examType === et ? "bg-cyan-500 border-cyan-500 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"}`}>
                        {et}
                      </button>
                    ))}
                  </div>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Exam type" value={examType} onChange={(e) => setExamType(e.target.value)} required />
                  <Button type="submit" className="w-full">Save Subject</Button>
                </form>

                <form onSubmit={onCreateTopic} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> New Chapter
                  </h2>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Chapter title" value={topicTitle} onChange={(e) => setTopicTitle(e.target.value)} required />
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={topicSubjectId} onChange={(e) => setTopicSubjectId(Number(e.target.value))} required>
                    <option value="">Select subject</option>
                    {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                  </select>
                  <Button type="submit" className="w-full">Save Chapter</Button>
                </form>
              </div>

              <form onSubmit={onCreateMaterial} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-cyan-500" /> New Material
                </h2>
                <div className="grid md:grid-cols-3 gap-3">
                  <input className="border rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder="Material title" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)} required />
                  <select className="border rounded-lg px-3 py-2 text-sm" value={materialType} onChange={(e) => setMaterialType(e.target.value as "notes" | "past_paper")}>
                    <option value="notes">Notes</option>
                    <option value="past_paper">Past Paper</option>
                  </select>
                </div>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={materialTopicId} onChange={(e) => setMaterialTopicId(Number(e.target.value))} required>
                  <option value="">Select chapter</option>
                  {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                </select>
                <textarea className="w-full border rounded-lg px-3 py-2 min-h-28 text-sm" placeholder="Material content" value={materialContent} onChange={(e) => setMaterialContent(e.target.value)} required />
                <Button type="submit" className="w-full">Save Material</Button>
              </form>

              <form onSubmit={onCreateMCQ} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <PlusCircle className="h-4 w-4 text-cyan-500" /> New MCQ
                </h2>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={mcqTopicId} onChange={(e) => setMcqTopicId(Number(e.target.value))} required>
                  <option value="">Select chapter</option>
                  {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                </select>
                <textarea className="w-full border rounded-lg px-3 py-2 min-h-20 text-sm" placeholder="Question" value={question} onChange={(e) => setQuestion(e.target.value)} required />
                <div className="grid md:grid-cols-2 gap-3">
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} required />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} required />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} required />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} required />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-slate-600">Correct answer:</label>
                  {(["A", "B", "C", "D"] as const).map((opt) => (
                    <button key={opt} type="button" onClick={() => setCorrectAnswer(opt)}
                      className={`w-8 h-8 rounded-full text-sm font-bold transition-colors ${correctAnswer === opt ? "bg-green-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                <textarea className="w-full border rounded-lg px-3 py-2 min-h-16 text-sm" placeholder="Explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} required />
                <Button type="submit" className="w-full">Save MCQ</Button>
              </form>

              <div className="grid md:grid-cols-2 gap-4">
                <form onSubmit={onCreateTip} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> Tips and Tricks
                  </h2>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={tipSubjectId} onChange={(e) => setTipSubjectId(Number(e.target.value))} required>
                    <option value="">Select subject</option>
                    {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                  </select>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Tip title" value={tipTitle} onChange={(e) => setTipTitle(e.target.value)} required />
                  <textarea className="w-full border rounded-lg px-3 py-2 min-h-20 text-sm" placeholder="Study strategy / exam tip" value={tipContent} onChange={(e) => setTipContent(e.target.value)} required />
                  <Button type="submit" className="w-full">Save Tip</Button>
                </form>

                <form onSubmit={onCreateResource} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> Resource Link
                  </h2>
                  <p className="text-xs text-muted-foreground">Add Google Drive links or external URLs to a chapter.</p>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Resource title" value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)} required />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="URL (https://...)" value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} required />
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={resourceChapterId} onChange={(e) => setResourceChapterId(Number(e.target.value))} required>
                    <option value="">Select chapter</option>
                    {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                  </select>
                  <Button type="submit" className="w-full">Save Resource</Button>
                </form>

                <form onSubmit={onCreateNote} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> Note
                  </h2>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Note title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} required />
                  <textarea className="w-full border rounded-lg px-3 py-2 min-h-20 text-sm" placeholder="Note content (text or URL)" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} required />
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={noteSubjectId} onChange={(e) => setNoteSubjectId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">-- Subject (optional) --</option>
                    {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                  </select>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={noteChapterId} onChange={(e) => setNoteChapterId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">-- Chapter (optional) --</option>
                    {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                  </select>
                  <Button type="submit" className="w-full">Save Note</Button>
                </form>

                <form onSubmit={onCreatePastPaper} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                  <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-4 w-4 text-cyan-500" /> Past Paper (Legacy)
                  </h2>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" value={pastPaperSubjectId} onChange={(e) => setPastPaperSubjectId(Number(e.target.value))} required>
                    <option value="">Select subject</option>
                    {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                  </select>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" type="number" min={2000} max={2100} value={pastPaperYear} onChange={(e) => setPastPaperYear(Number(e.target.value))} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Title (optional)" value={pastPaperTitle} onChange={(e) => setPastPaperTitle(e.target.value)} />
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" type="file" accept="application/pdf" onChange={(e) => setPastPaperFile((e.target.files && e.target.files[0]) || null)} />
                  <textarea className="w-full border rounded-lg px-3 py-2 min-h-20 text-sm" placeholder="PDF link or content (optional)" value={pastPaperContent} onChange={(e) => setPastPaperContent(e.target.value)} />
                  <Button type="submit" className="w-full">Save Past Paper</Button>
                </form>
              </div>

              <form onSubmit={onCreatePaper} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <PlusCircle className="h-4 w-4 text-cyan-500" /> Past Paper (New System)
                </h2>
                <p className="text-xs text-muted-foreground">Stored in the dedicated past-papers table. Appears under subject Past Papers panel.</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <select className="border rounded-lg px-3 py-2 text-sm" value={paperSubjectId} onChange={(e) => setPaperSubjectId(Number(e.target.value))} required>
                    <option value="">Select subject *</option>
                    {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                  </select>
                  <select className="border rounded-lg px-3 py-2 text-sm" value={paperChapterId} onChange={(e) => setPaperChapterId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">-- Chapter (optional) --</option>
                    {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                  </select>
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Paper title *" value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)} required />
                  <input className="border rounded-lg px-3 py-2 text-sm" placeholder="External URL (optional)" value={paperUrl} onChange={(e) => setPaperUrl(e.target.value)} />
                </div>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" type="file" accept="application/pdf" onChange={(e) => setPaperFile((e.target.files && e.target.files[0]) || null)} />
                {paperFile && <p className="text-xs text-muted-foreground">{paperFile.name}</p>}
                <Button type="submit" className="w-full">Save Past Paper</Button>
              </form>

              <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-5">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <Layers className="h-4 w-4 text-cyan-500" /> Manage Existing Content
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Filter by Subject</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm" value={manageSubjectId} onChange={(e) => setManageSubjectId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">All subjects</option>
                      {sortedSubjects.map((s) => (<option key={s.id} value={s.id}>{s.name} ({s.exam_type})</option>))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Show Materials for Chapter</label>
                    <select className="w-full border rounded-lg px-3 py-2 text-sm" value={manageTopicId} onChange={(e) => setManageTopicId(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Select chapter</option>
                      {manageSubjectTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-600">Subjects ({sortedSubjects.length})</h3>
                    <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
                      {(manageSubjectId ? sortedSubjects.filter((s) => s.id === manageSubjectId) : sortedSubjects).map((subject) => (
                        <div key={subject.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          <div className="flex-1 min-w-0">
                            {editSubjectId === subject.id ? (
                              <form onSubmit={(e) => { e.preventDefault(); onSaveEditSubject(subject); }} className="flex gap-2 items-center">
                                <input className="border rounded px-2 py-1 text-sm flex-1" value={editSubjectName} onChange={(e) => setEditSubjectName(e.target.value)} autoFocus />
                                <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-subject-${subject.id}`}>Save</Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEditSubjectId(null)}>x</Button>
                              </form>
                            ) : (
                              <>
                                <p className="text-sm font-medium truncate">{subject.name}</p>
                                <p className="text-xs text-muted-foreground">{subject.exam_type}</p>
                              </>
                            )}
                          </div>
                          {editSubjectId !== subject.id && (
                            <div className="flex gap-1 shrink-0">
                              <Button type="button" variant="ghost" size="icon" onClick={() => onEditSubject(subject)} disabled={!!editSubjectId || !!actionBusy} title="Rename">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteSubject(subject.id, subject.name)} disabled={actionBusy === `subject-${subject.id}`} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <h3 className="mb-2 text-sm font-semibold text-slate-600">Chapters ({manageSubjectTopics.length})</h3>
                    <div className="max-h-64 space-y-1.5 overflow-auto pr-1">
                      {manageSubjectTopics.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No chapters -- select a subject above.</p>
                      ) : (
                        manageSubjectTopics.map((topic) => (
                          <div key={topic.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                            <div className="flex-1 min-w-0">
                              {editTopicId === topic.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); onSaveEditTopic(topic); }} className="flex gap-2 items-center">
                                  <input className="border rounded px-2 py-1 text-sm flex-1" value={editTopicTitle} onChange={(e) => setEditTopicTitle(e.target.value)} autoFocus />
                                  <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-topic-${topic.id}`}>Save</Button>
                                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditTopicId(null)}>x</Button>
                                </form>
                              ) : (
                                <p className="text-sm font-medium truncate">{topic.title}</p>
                              )}
                            </div>
                            {editTopicId !== topic.id && (
                              <div className="flex gap-1 shrink-0">
                                <Button type="button" variant="ghost" size="icon" onClick={() => onEditTopic(topic)} disabled={!!editTopicId || !!actionBusy} title="Rename">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteTopic(topic.id, topic.title)} disabled={actionBusy === `topic-${topic.id}`} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Materials in Selected Chapter
                  </h3>
                  {!manageTopicId ? (
                    <p className="text-xs text-muted-foreground">Select a chapter above.</p>
                  ) : topicMaterials.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No materials found.</p>
                  ) : (
                    <div className="max-h-56 space-y-1.5 overflow-auto pr-1">
                      {topicMaterials.map((material) => (
                        <div key={material.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          <div className="flex-1 min-w-0">
                            {editMaterialId === material.id ? (
                              <form onSubmit={(e) => { e.preventDefault(); onSaveEditMaterial(material); }} className="flex gap-2 items-center">
                                <input className="border rounded px-2 py-1 text-sm flex-1" value={editMaterialTitle} onChange={(e) => setEditMaterialTitle(e.target.value)} autoFocus />
                                <Button type="submit" size="sm" variant="outline" disabled={actionBusy === `edit-material-${material.id}`}>Save</Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEditMaterialId(null)}>x</Button>
                              </form>
                            ) : (
                              <>
                                <p className="text-sm font-medium truncate">{material.title}</p>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide">{material.type}</p>
                              </>
                            )}
                          </div>
                          {editMaterialId !== material.id && (
                            <div className="flex gap-1 shrink-0">
                              <Button type="button" variant="ghost" size="icon" onClick={() => onEditMaterial(material)} disabled={!!editMaterialId || !!actionBusy} title="Rename">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteMaterial(material.id, material.title)} disabled={actionBusy === `material-${material.id}`} title="Delete" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Resource Links
                  </h3>
                  {!manageTopicId ? (
                    <p className="text-xs text-muted-foreground">Select a chapter above.</p>
                  ) : chapterResources.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No resource links.</p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                      {chapterResources.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{r.title}</p>
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 truncate block">{r.url}</a>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteResource(r.id, r.title)} disabled={actionBusy === `resource-${r.id}`} className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Chapter Notes
                  </h3>
                  {!manageTopicId ? (
                    <p className="text-xs text-muted-foreground">Select a chapter above.</p>
                  ) : chapterNotesList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No chapter-level notes.</p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                      {chapterNotesList.map((n) => (
                        <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{n.content}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteNote(n.id, n.title)} disabled={actionBusy === `note-${n.id}`} className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <h3 className="mb-2 text-sm font-semibold text-slate-600 flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" /> Subject Notes
                  </h3>
                  {!manageSubjectId ? (
                    <p className="text-xs text-muted-foreground">Select a subject above.</p>
                  ) : subjectNotesList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No subject-level notes.</p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                      {subjectNotesList.map((n) => (
                        <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{n.content}</p>
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => onDeleteNote(n.id, n.title)} disabled={actionBusy === `note-${n.id}`} className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "mcqs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 px-4 py-2.5 text-center border border-cyan-200">
                    <p className="text-2xl font-bold text-cyan-700">{totalMCQs.toLocaleString()}</p>
                    <p className="text-xs text-cyan-600">Total MCQs</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-center border border-slate-200">
                    <p className="text-2xl font-bold text-slate-700">{subjects.length}</p>
                    <p className="text-xs text-slate-500">Subjects</p>
                  </div>
                  <div className="rounded-xl bg-slate-100 px-4 py-2.5 text-center border border-slate-200">
                    <p className="text-2xl font-bold text-slate-700">{topics.length}</p>
                    <p className="text-xs text-slate-500">Chapters</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={mcqFilterExamType} onChange={(e) => setMcqFilterExamType(e.target.value)}>
                    <option value="all">All Exam Types</option>
                    {EXAM_TYPES.map((et) => (<option key={et} value={et}>{et}</option>))}
                  </select>
                  <Button variant="outline" size="sm" onClick={loadMCQStats} disabled={mcqStatsLoading}>
                    {mcqStatsLoading ? "Loading..." : "Refresh"}
                  </Button>
                </div>
              </div>

              {mcqStatsLoading ? (
                <div className="rounded-2xl border bg-white p-12 text-center text-muted-foreground shadow-sm">
                  Loading MCQ statistics...
                </div>
              ) : mcqStats.length === 0 ? (
                <div className="rounded-2xl border bg-white p-12 text-center text-muted-foreground shadow-sm">
                  No MCQ data found. Upload some MCQs first.
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(filteredMcqStats).sort(([a], [b]) => a.localeCompare(b)).map(([et, subjectMap]) => {
                    const examTotal = Object.values(subjectMap).reduce((sum, v) => sum + v.total, 0);
                    return (
                      <div key={et} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-gradient-to-r from-cyan-500 to-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">{et}</span>
                            <span className="text-sm text-slate-500">{Object.keys(subjectMap).length} subjects</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-700">{examTotal.toLocaleString()} MCQs</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {Object.entries(subjectMap).sort(([a], [b]) => a.localeCompare(b)).map(([sName, { total, chapters }]) => {
                            const subjectKey = `${et}||${sName}`;
                            const isExpanded = expandedSubjects.has(subjectKey);
                            const subjectObj = subjects.find((s) => s.name === sName && s.exam_type === et);
                            return (
                              <div key={sName}>
                                <button
                                  onClick={() => toggleExpandSubject(subjectKey)}
                                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                                >
                                  <div className="flex items-center gap-2">
                                    {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                    <span className="font-medium text-slate-700">{sName}</span>
                                    <span className="text-xs text-muted-foreground">{chapters.length} chapters</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">{total.toLocaleString()} MCQs</span>
                                    {subjectObj && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); onDeleteSubject(subjectObj.id, sName); }}
                                        className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7"
                                        title="Delete subject"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="bg-slate-50/80 border-t border-slate-100 divide-y divide-slate-100">
                                    {chapters.sort((a, b) => a.chapter.localeCompare(b.chapter)).map(({ chapter, mcqs, topic }) => {
                                      const chapterKey = `${sName}||${chapter}`;
                                      const isChapterExpanded = expandedChapters.has(chapterKey);
                                      const isLoadingMCQs = chapterMCQsLoading.has(chapterKey);
                                      const loadedMCQs = chapterMCQs[chapterKey];
                                      const isDeletingAll = deletingChapterMCQs === chapterKey;
                                      const displayCount = loadedMCQs ? loadedMCQs.length : mcqs;
                                      return (
                                        <div key={chapter}>
                                          <div className="flex items-center justify-between pl-10 pr-4 py-2.5 hover:bg-white transition-colors">
                                            <button
                                              onClick={() => toggleExpandChapter(chapterKey, topic?.id)}
                                              className="flex items-center gap-2 flex-1 text-left min-w-0"
                                            >
                                              {isChapterExpanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                                              <span className="text-sm text-slate-600 truncate">{chapter}</span>
                                            </button>
                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${displayCount > 0 ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"}`}>
                                                {displayCount} MCQs
                                              </span>
                                              {topic && displayCount > 0 && (
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="sm"
                                                  onClick={() => onDeleteAllChapterMCQs(chapterKey, topic.id, chapter)}
                                                  disabled={isDeletingAll}
                                                  className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50 h-7 px-2"
                                                >
                                                  {isDeletingAll ? "Deleting..." : "Delete All"}
                                                </Button>
                                              )}
                                            </div>
                                          </div>

                                          {isChapterExpanded && (
                                            <div className="bg-white border-t border-slate-100 pl-14 pr-4 py-2 space-y-1.5">
                                              {isLoadingMCQs ? (
                                                <p className="text-xs text-muted-foreground py-2">Loading MCQs...</p>
                                              ) : !loadedMCQs || loadedMCQs.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-2">No MCQs found.</p>
                                              ) : (
                                                loadedMCQs.map((mcq) => (
                                                  <div key={mcq.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm text-slate-700 line-clamp-2">{mcq.question}</p>
                                                      <p className="text-xs text-muted-foreground mt-0.5">
                                                        Correct: <span className="font-semibold text-green-600">{mcq.correct_answer}</span>
                                                        {" - "}
                                                        <span className="truncate">{mcq.option_a} / {mcq.option_b} / {mcq.option_c} / {mcq.option_d}</span>
                                                      </p>
                                                    </div>
                                                    <Button
                                                      type="button"
                                                      variant="ghost"
                                                      size="icon"
                                                      onClick={() => onDeleteSingleMCQ(mcq.id, chapterKey, chapter, sName)}
                                                      disabled={deletingMCQ === mcq.id}
                                                      className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0 h-7 w-7"
                                                      title="Delete MCQ"
                                                    >
                                                      <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </div>
                                                ))
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="space-y-5">
              <form onSubmit={onUploadMCQCSV} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <Upload className="h-4 w-4 text-cyan-500" /> Bulk Upload MCQs via CSV
                </h2>
                <p className="text-xs text-muted-foreground">
                  CSV columns: question, option1, option2, option3, option4, correct_answer, subject, chapter (plus optional explanation).
                  Correct answer must be A-D.
                </p>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={csvExamType} onChange={(e) => setCsvExamType(e.target.value)} required>
                  <option value="ALL">All Categories (USAT-E, M, CS, GS, A) — adds subject/chapter to every type</option>
                  <option value="USAT-E">USAT-E (Pre-Engineering)</option>
                  <option value="USAT-M">USAT-M (Pre-Medical)</option>
                  <option value="USAT-CS">USAT-CS (Computer Science)</option>
                  <option value="USAT-GS">USAT-GS (General Science)</option>
                  <option value="USAT-A">USAT-A (Arts and Humanities)</option>
                </select>
                {csvExamType === "ALL" && (
                  <p className="text-xs rounded-lg bg-cyan-50 border border-cyan-200 px-3 py-2 text-cyan-700">
                    <strong>All Categories mode:</strong> Each MCQ row will be inserted under <em>every</em> exam type. Use this for shared subjects like Verbal Reasoning or English that appear across all USAT variants.
                  </p>
                )}
                <input className="w-full border rounded-lg px-3 py-2 text-sm" type="file" accept=".csv,text/csv" onChange={(e) => setCsvFile((e.target.files && e.target.files[0]) || null)} required />
                {csvFile && <p className="text-xs text-muted-foreground">{csvFile.name}</p>}
                <Button type="submit" className="w-full" disabled={!csvFile || isUploadingCSV}>
                  {isUploadingCSV ? "Uploading..." : csvExamType === "ALL" ? "Upload to All Categories" : "Upload MCQ CSV"}
                </Button>
              </form>

              <form onSubmit={onUploadEssayCSV} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <Upload className="h-4 w-4 text-cyan-500" /> Bulk Upload Essay Prompts via CSV
                </h2>
                <p className="text-xs text-muted-foreground">
                  CSV columns: essay_type, prompt_text (optional exam_type).
                  essay_type must be argumentative or narrative.
                </p>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" type="file" accept=".csv,text/csv" onChange={(e) => setEssayCsvFile((e.target.files && e.target.files[0]) || null)} required />
                {essayCsvFile && <p className="text-xs text-muted-foreground">{essayCsvFile.name}</p>}
                <Button type="submit" className="w-full" disabled={!essayCsvFile || isUploadingEssayCSV}>
                  {isUploadingEssayCSV ? "Uploading..." : "Upload Essay CSV"}
                </Button>
              </form>

              <form onSubmit={onUploadPDFs} className="rounded-2xl border bg-white p-5 space-y-3 shadow-sm">
                <h2 className="font-semibold flex items-center gap-2 text-slate-700">
                  <Upload className="h-4 w-4 text-cyan-500" /> Upload Multiple PDFs to a Chapter
                </h2>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" value={pdfTopicId} onChange={(e) => setPdfTopicId(Number(e.target.value))} required>
                  <option value="">Select chapter</option>
                  {sortedTopics.map((t) => (<option key={t.id} value={t.id}>{t.title}</option>))}
                </select>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" type="file" accept="application/pdf" multiple onChange={(e) => setPdfFiles(Array.from(e.target.files || []))} required />
                {pdfFiles.length > 0 && <p className="text-xs text-muted-foreground">{pdfFiles.length} PDF file(s) selected</p>}
                <Button type="submit" className="w-full">Upload PDFs</Button>
              </form>
            </div>
          )}

          {activeTab === "users" && (
            <div className="space-y-5">
              <section className="rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50/40 p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-bold">Grant / Revoke Pro</h2>
                </div>
                <form onSubmit={handleGrantProByEmail} className="flex flex-col sm:flex-row gap-3">
                  <input
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    type="email"
                    placeholder="User email"
                    value={grantEmail}
                    onChange={(e) => setGrantEmail(e.target.value)}
                    required
                  />
                  <input
                    className="w-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
                    type="number"
                    min={1}
                    max={3650}
                    placeholder="Days"
                    value={grantDays}
                    onChange={(e) => setGrantDays(Number(e.target.value) || 30)}
                  />
                  <Button type="submit" disabled={grantLoading || !grantEmail.trim()} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    {grantLoading ? "..." : "Grant Pro"}
                  </Button>
                  <Button type="button" variant="outline" disabled={grantLoading || !grantEmail.trim()} className="border-red-200 text-red-600 hover:bg-red-50" onClick={handleRevokeProByEmail}>
                    {grantLoading ? "..." : "Revoke Pro"}
                  </Button>
                </form>
              </section>

              <section className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-lg font-bold">All Users</h2>
                    <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-600">{allUsers.length}</span>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      className="rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition w-64"
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
                              <p className="font-medium text-slate-700">{u.full_name || "(no name)"}</p>
                              <p className="text-xs text-slate-400">{u.email}</p>
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
                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                                  <Crown className="h-3 w-3" /> Pro (Admin)
                                </span>
                              ) : u.is_pro ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                                  <Crown className="h-3 w-3" /> Pro
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">Free</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {u.is_admin ? (
                                <span className="text-xs text-slate-300">--</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant={u.is_pro ? "outline" : "default"}
                                  className={u.is_pro ? "border-red-200 text-red-600 hover:bg-red-50" : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"}
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
          )}

          {activeTab === "tools" && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-700">Remove Duplicate Subjects</h3>
                <p className="text-sm text-muted-foreground">Merges subjects with identical names (same exam type), moving all chapters, materials, and MCQs to the canonical entry.</p>
                <Button variant="outline" className="w-full" onClick={onDedupeSubjects}>Run Deduplication</Button>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-700">Delete Placeholder MCQs</h3>
                <p className="text-sm text-muted-foreground">Removes auto-generated MCQs matching "USAT sample MCQ: key concept from..."</p>
                <Button variant="destructive" className="w-full" onClick={onPurgePlaceholderMCQs}>Delete Placeholder MCQs</Button>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-700">Clear Quantitative Reasoning MCQs</h3>
                <p className="text-sm text-muted-foreground">Deletes all MCQs under every Quantitative Reasoning subject across all exam types. Subjects and chapters are preserved.</p>
                <Button variant="destructive" className="w-full" onClick={onPurgeQuantitativeMCQs}>Clear QR MCQs</Button>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-700">Purge MCQs by Subject Name</h3>
                <p className="text-sm text-muted-foreground">Delete all MCQs under every subject matching the given name (case-insensitive). Subjects and chapters remain.</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="e.g. Physics"
                    value={purgeSubjectName}
                    onChange={(e) => setPurgeSubjectName(e.target.value)}
                  />
                  <Button variant="destructive" disabled={!purgeSubjectName.trim()} onClick={onPurgeBySubjectName}>Purge</Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default AdminContent;
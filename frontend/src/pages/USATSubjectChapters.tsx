import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, Download, Eye, FileText, Flame, Globe, Layers,
  Lightbulb, Link2, ListChecks, Loader2, Plus, Trash2, Upload, X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, PastPaper, Subject, SubjectResource, Tip, Topic, UserNote, API_ORIGIN } from "@/services/api";

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const resolveLink = (value: string): string | null => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return `${API_ORIGIN}${trimmed}`;
  return null;
};

const readYear = (title: string): string => {
  const match = title.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : "N/A";
};

const MCQ_PAGE_SIZE = 30;

/* -- tiny reusable admin form wrapper -- */
const InlineForm = ({
  label, show, onToggle, onSubmit, busy, children,
}: {
  label: string; show: boolean; onToggle: () => void;
  onSubmit: (e: FormEvent) => void; busy: boolean; children: React.ReactNode;
}) => (
  <>
    {!show && (
      <button type="button" onClick={onToggle}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-300 py-1.5 text-[10px] font-bold text-violet-500 transition hover:bg-violet-50">
        <Plus className="h-3 w-3" /> {label}
      </button>
    )}
    {show && (
      <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
        onSubmit={onSubmit} className="mt-2 space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
        {children}
        <div className="flex gap-2">
          <button type="submit" disabled={busy}
            className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[10px] font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Save"}
          </button>
          <button type="button" onClick={onToggle}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white">
            Cancel
          </button>
        </div>
      </motion.form>
    )}
  </>
);

const SmallInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:outline-none ${props.className ?? ""}`} />
);

const SmallTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:outline-none ${props.className ?? ""}`} rows={2} />
);

const DelBtn = ({ onClick, title }: { onClick: () => void; title?: string }) => (
  <button type="button" onClick={onClick} title={title ?? "Delete"}
    className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-500 hover:text-white">
    <Trash2 className="h-2.5 w-2.5" />
  </button>
);

const USATSubjectChapters = () => {
  const { category = "", subject = "" } = useParams();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Topic[]>([]);
  const [subjectPapers, setSubjectPapers] = useState<PastPaper[]>([]);
  const [subjectTips, setSubjectTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // User-uploaded PDF notes
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [showAddUserNote, setShowAddUserNote] = useState(false);
  const [userNoteTitle, setUserNoteTitle] = useState("");
  const [userNoteFile, setUserNoteFile] = useState<File | null>(null);
  const [userNoteBusy, setUserNoteBusy] = useState(false);
  const [userNotePdfUrl, setUserNotePdfUrl] = useState<string | null>(null);

  // Accordion
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(null);

  // Per-chapter lazy-loaded data
  const [chapterMcqsById, setChapterMcqsById] = useState<Record<number, MCQ[]>>({});
  const [chapterMcqOffsets, setChapterMcqOffsets] = useState<Record<number, number>>({});
  const [chapterMcqHasMore, setChapterMcqHasMore] = useState<Record<number, boolean>>({});
  const [chapterLoadingById, setChapterLoadingById] = useState<Record<number, boolean>>({});
  const [chapterMcqLoadingById, setChapterMcqLoadingById] = useState<Record<number, boolean>>({});

  // Admin inline form toggles
  const [showAddChapter, setShowAddChapter] = useState(false);
  const [addChapterTitle, setAddChapterTitle] = useState("");
  const [showAddMCQFor, setShowAddMCQFor] = useState<number | null>(null);
  const [mcqQ, setMcqQ] = useState("");
  const [mcqA, setMcqA] = useState("");
  const [mcqB, setMcqB] = useState("");
  const [mcqC, setMcqC] = useState("");
  const [mcqD, setMcqD] = useState("");
  const [mcqCorrect, setMcqCorrect] = useState<"A"|"B"|"C"|"D">("A");
  const [mcqExpl, setMcqExpl] = useState("");
  const [showAddPaper, setShowAddPaper] = useState(false);
  const [paperTitle, setPaperTitle] = useState("");
  const [paperUrl, setPaperUrl] = useState("");
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [showAddTip, setShowAddTip] = useState(false);
  const [tipTitle, setTipTitle] = useState("");
  const [tipContent, setTipContent] = useState("");
  const [busy, setBusy] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);

  // Subject-level resources
  const [subjectResources, setSubjectResources] = useState<SubjectResource[]>([]);
  const [showAddSubjRes, setShowAddSubjRes] = useState(false);
  const [subjResTitle, setSubjResTitle] = useState("");
  const [subjResUrl, setSubjResUrl] = useState("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient.checkIsAdmin().then(setIsAdmin).catch(() => {});
  }, []);

  const lastFetchKey = useRef("");

  useEffect(() => {
    const key = `${category}|${subject}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    (async () => {
      if (!category || !subject) return;
      setLoading(true);
      const fetchedSubjects = await apiClient.listUSATCategorySubjects(category);
      const matched = fetchedSubjects.find((item) => slugify(item.name) === subject) || null;
      setSubjectInfo(matched);
      if (!matched) { setChapters([]); setSubjectPapers([]); setSubjectTips([]); setUserNotes([]); setSubjectResources([]); setExpandedChapterId(null); return; }
      const [fetchedChapters, papers, tips, sResources] = await Promise.all([
        apiClient.listTopics(matched.id),
        apiClient.listSubjectPapers(matched.id),
        apiClient.listSubjectTips(matched.id),
        apiClient.listSubjectResources(matched.id),
      ]);
      setChapters(fetchedChapters);
      setSubjectPapers(papers);
      setSubjectTips(tips);
      setSubjectResources(sResources);
      // Load user notes separately (requires auth, may fail for guests)
      apiClient.listUserNotes(matched.id).then(setUserNotes).catch(() => setUserNotes([]));
    })()
      .catch(() => { setSubjectInfo(null); setChapters([]); setSubjectPapers([]); setSubjectTips([]); setUserNotes([]); setSubjectResources([]); })
      .finally(() => setLoading(false));
  }, [category, subject]);

  const loadChapterData = useCallback(async (chapterId: number) => {
    if (chapterLoadingById[chapterId]) return;
    if (chapterMcqsById[chapterId] !== undefined) return;
    setChapterLoadingById((prev) => ({ ...prev, [chapterId]: true }));
    try {
      const mcqs = await apiClient.listChapterMCQsPaginated(chapterId, MCQ_PAGE_SIZE, 0);
      setChapterMcqsById((prev) => ({ ...prev, [chapterId]: mcqs }));
      setChapterMcqOffsets((prev) => ({ ...prev, [chapterId]: MCQ_PAGE_SIZE }));
      setChapterMcqHasMore((prev) => ({ ...prev, [chapterId]: mcqs.length === MCQ_PAGE_SIZE }));
    } finally {
      setChapterLoadingById((prev) => ({ ...prev, [chapterId]: false }));
    }
  }, [chapterLoadingById, chapterMcqsById]);

  const toggleChapter = useCallback((chapterId: number) => {
    if (expandedChapterId === chapterId) { setExpandedChapterId(null); return; }
    setExpandedChapterId(chapterId);
    loadChapterData(chapterId).catch(() => {});
  }, [expandedChapterId, loadChapterData]);

  const loadMoreMCQs = useCallback(async (chapterId: number) => {
    if (chapterMcqLoadingById[chapterId]) return;
    const currentOffset = chapterMcqOffsets[chapterId] ?? 0;
    setChapterMcqLoadingById((prev) => ({ ...prev, [chapterId]: true }));
    try {
      const moreMcqs = await apiClient.listChapterMCQsPaginated(chapterId, MCQ_PAGE_SIZE, currentOffset);
      setChapterMcqsById((prev) => ({ ...prev, [chapterId]: [...(prev[chapterId] || []), ...moreMcqs] }));
      setChapterMcqOffsets((prev) => ({ ...prev, [chapterId]: currentOffset + MCQ_PAGE_SIZE }));
      setChapterMcqHasMore((prev) => ({ ...prev, [chapterId]: moreMcqs.length === MCQ_PAGE_SIZE }));
    } finally {
      setChapterMcqLoadingById((prev) => ({ ...prev, [chapterId]: false }));
    }
  }, [chapterMcqLoadingById, chapterMcqOffsets]);

  /* -- Admin handlers ---------------------------------------- */

  const addChapter = async (e: FormEvent) => {
    e.preventDefault();
    if (!addChapterTitle.trim() || !subjectInfo || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createTopic({ title: addChapterTitle.trim(), subject_id: subjectInfo.id });
      setChapters((prev) => [...prev, created]);
      setAddChapterTitle(""); setShowAddChapter(false);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const deleteChapter = async (id: number) => {
    if (!confirm("Delete this chapter and all its content?")) return;
    try { await apiClient.deleteTopic(id); setChapters((prev) => prev.filter((c) => c.id !== id)); }
    catch (err: any) { alert(err.message); }
  };

  const addMCQ = async (e: FormEvent, chapterId: number) => {
    e.preventDefault();
    if (!mcqQ.trim() || !mcqA.trim() || !mcqB.trim() || !mcqC.trim() || !mcqD.trim() || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createMCQ({
        question: mcqQ.trim(), option_a: mcqA.trim(), option_b: mcqB.trim(),
        option_c: mcqC.trim(), option_d: mcqD.trim(), correct_answer: mcqCorrect,
        explanation: mcqExpl, topic_id: chapterId,
      });
      setChapterMcqsById((prev) => ({ ...prev, [chapterId]: [...(prev[chapterId] || []), created] }));
      setMcqQ(""); setMcqA(""); setMcqB(""); setMcqC(""); setMcqD(""); setMcqCorrect("A"); setMcqExpl("");
      setShowAddMCQFor(null);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const deleteMCQ = async (mcqId: number, chapterId: number) => {
    try {
      await apiClient.deleteMCQ(mcqId);
      setChapterMcqsById((prev) => ({ ...prev, [chapterId]: (prev[chapterId] || []).filter((m) => m.id !== mcqId) }));
    } catch (err: any) { alert(err.message); }
  };

  const handleCSVUpload = async (chapterId: number, file: File) => {
    setBusy(true);
    try {
      const result = await apiClient.uploadMCQCSV(file, category.toUpperCase());
      alert(`Uploaded: ${result.created} created, ${result.skipped} skipped`);
      const mcqs = await apiClient.listChapterMCQsPaginated(chapterId, MCQ_PAGE_SIZE, 0);
      setChapterMcqsById((prev) => ({ ...prev, [chapterId]: mcqs }));
      setChapterMcqOffsets((prev) => ({ ...prev, [chapterId]: MCQ_PAGE_SIZE }));
      setChapterMcqHasMore((prev) => ({ ...prev, [chapterId]: mcqs.length === MCQ_PAGE_SIZE }));
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); if (csvRef.current) csvRef.current.value = ""; }
  };

  const addPaper = async (e: FormEvent) => {
    e.preventDefault();
    if (!paperTitle.trim() || !subjectInfo || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createPaper({ title: paperTitle.trim(), subject_id: subjectInfo.id, url: paperUrl.trim() || undefined, file: paperFile ?? undefined });
      setSubjectPapers((prev) => [...prev, created]);
      setPaperTitle(""); setPaperUrl(""); setPaperFile(null); setShowAddPaper(false);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const deletePaper = async (id: number) => {
    try { await apiClient.deletePaper(id); setSubjectPapers((prev) => prev.filter((p) => p.id !== id)); }
    catch (err: any) { alert(err.message); }
  };

  const addTip = async (e: FormEvent) => {
    e.preventDefault();
    if (!tipTitle.trim() || !tipContent.trim() || !subjectInfo || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createTip({ title: tipTitle.trim(), content: tipContent.trim(), subject_id: subjectInfo.id });
      setSubjectTips((prev) => [...prev, created]);
      setTipTitle(""); setTipContent(""); setShowAddTip(false);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const deleteTip = async (id: number) => {
    try { await apiClient.deleteTip(id); setSubjectTips((prev) => prev.filter((t) => t.id !== id)); }
    catch (err: any) { alert(err.message); }
  };

  const addSubjectResource = async (e: FormEvent) => {
    e.preventDefault();
    if (!subjResTitle.trim() || !subjResUrl.trim() || !subjectInfo || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createSubjectResource({ title: subjResTitle.trim(), url: subjResUrl.trim(), subject_id: subjectInfo.id });
      setSubjectResources((prev) => [created, ...prev]);
      setSubjResTitle(""); setSubjResUrl(""); setShowAddSubjRes(false);
    } catch (err: any) { alert(err.message); }
    finally { setBusy(false); }
  };

  const deleteSubjectResource = async (id: number) => {
    try { await apiClient.deleteSubjectResource(id); setSubjectResources((prev) => prev.filter((r) => r.id !== id)); }
    catch (err: any) { alert(err.message); }
  };

  const uploadUserNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!userNoteTitle.trim() || !userNoteFile || !subjectInfo || userNoteBusy) return;
    setUserNoteBusy(true);
    try {
      const created = await apiClient.uploadUserNote(subjectInfo.id, userNoteTitle.trim(), userNoteFile);
      setUserNotes((prev) => [created, ...prev]);
      setUserNoteTitle(""); setUserNoteFile(null); setShowAddUserNote(false);
    } catch (err: any) { alert(err.message || "Upload failed"); }
    finally { setUserNoteBusy(false); }
  };

  const deleteUserNote = async (id: number) => {
    if (!confirm("Delete this note?")) return;
    try { await apiClient.deleteUserNote(id); setUserNotes((prev) => prev.filter((n) => n.id !== id)); }
    catch (err: any) { alert(err.message); }
  };

  const viewUserNotePdf = async (noteId: number) => {
    try {
      // Fetch the direct Supabase URL (skips the 307 redirect)
      const directUrl = await apiClient.getUserNoteDirectUrl(noteId);
      setUserNotePdfUrl(directUrl);
    } catch {
      // Fallback to the old redirect-based flow
      const token = apiClient.getToken?.();
      const url = apiClient.getUserNoteViewUrl(noteId);
      setUserNotePdfUrl(`${url}?token=${encodeURIComponent(token || "")}`);
    }
  };

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">

        {/* decorative blobs */}
        <motion.div aria-hidden animate={{ x: [0, 22, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, -18, 0], y: [0, 20, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, 12, 0], y: [0, -10, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4">

          {/* -- HERO HEADER -- */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-500/30">
            <Link to={`/usat/${encodeURIComponent(category)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Subjects
            </Link>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {subjectInfo?.name || "Subject"}
            </h1>
            <p className="mt-1 text-sm font-medium text-violet-200">{category} � Chapters Window</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { label: "Chapters", value: chapters.length, color: "bg-white/20 text-white" },
                { label: "Subject Notes", value: userNotes.length, color: "bg-cyan-400/30 text-cyan-100" },
                { label: "Past Papers", value: subjectPapers.length, color: "bg-fuchsia-400/30 text-fuchsia-100" },
              ].map((stat) => (
                <div key={stat.label}
                  className={`${stat.color} flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold backdrop-blur-sm`}>
                  <span className="text-xl font-black">{stat.value}</span>
                  <span className="opacity-80">{stat.label}</span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* -- LOADING SKELETON -- */}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">

              {/* ------ LEFT COLUMN � Accordion Chapters ------ */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }}>
                <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-lg shadow-violet-100/40">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-violet-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                      <Layers className="h-4 w-4 text-violet-600" />
                    </span>
                    Chapters
                  </h2>

                  {chapters.length === 0 && !isAdmin ? (
                    <p className="text-sm text-slate-400">No chapters available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const chapterColors = [
                          { bg: "bg-violet-50", border: "border-violet-200", expandBg: "bg-gradient-to-r from-violet-50 to-purple-50", expandBorder: "border-violet-300 shadow-violet-100", label: "text-violet-500", title: "text-violet-900", hoverBg: "hover:bg-violet-50/50" },
                          { bg: "bg-sky-50", border: "border-sky-200", expandBg: "bg-gradient-to-r from-sky-50 to-blue-50", expandBorder: "border-sky-300 shadow-sky-100", label: "text-sky-500", title: "text-sky-900", hoverBg: "hover:bg-sky-50/50" },
                          { bg: "bg-emerald-50", border: "border-emerald-200", expandBg: "bg-gradient-to-r from-emerald-50 to-teal-50", expandBorder: "border-emerald-300 shadow-emerald-100", label: "text-emerald-500", title: "text-emerald-900", hoverBg: "hover:bg-emerald-50/50" },
                          { bg: "bg-amber-50", border: "border-amber-200", expandBg: "bg-gradient-to-r from-amber-50 to-yellow-50", expandBorder: "border-amber-300 shadow-amber-100", label: "text-amber-500", title: "text-amber-900", hoverBg: "hover:bg-amber-50/50" },
                          { bg: "bg-rose-50", border: "border-rose-200", expandBg: "bg-gradient-to-r from-rose-50 to-pink-50", expandBorder: "border-rose-300 shadow-rose-100", label: "text-rose-500", title: "text-rose-900", hoverBg: "hover:bg-rose-50/50" },
                          { bg: "bg-cyan-50", border: "border-cyan-200", expandBg: "bg-gradient-to-r from-cyan-50 to-teal-50", expandBorder: "border-cyan-300 shadow-cyan-100", label: "text-cyan-500", title: "text-cyan-900", hoverBg: "hover:bg-cyan-50/50" },
                          { bg: "bg-fuchsia-50", border: "border-fuchsia-200", expandBg: "bg-gradient-to-r from-fuchsia-50 to-pink-50", expandBorder: "border-fuchsia-300 shadow-fuchsia-100", label: "text-fuchsia-500", title: "text-fuchsia-900", hoverBg: "hover:bg-fuchsia-50/50" },
                          { bg: "bg-indigo-50", border: "border-indigo-200", expandBg: "bg-gradient-to-r from-indigo-50 to-blue-50", expandBorder: "border-indigo-300 shadow-indigo-100", label: "text-indigo-500", title: "text-indigo-900", hoverBg: "hover:bg-indigo-50/50" },
                        ];
                        return chapters.map((chapter, index) => {
                        const isExpanded = expandedChapterId === chapter.id;
                        const mcqs = chapterMcqsById[chapter.id] ?? [];
                        const isLoading = !!chapterLoadingById[chapter.id];
                        const isMcqLoading = !!chapterMcqLoadingById[chapter.id];
                        const hasMoreMcqs = !!chapterMcqHasMore[chapter.id];
                        const color = chapterColors[index % chapterColors.length];

                        return (
                          <div key={chapter.id}
                            className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                              isExpanded ? `${color.expandBorder} shadow-md` : color.border
                            }`}>
                            {/* Chapter header */}
                            <button type="button" onClick={() => toggleChapter(chapter.id)}
                              className={`flex w-full items-center justify-between p-3 text-left transition-colors duration-200 ${
                                isExpanded ? color.expandBg : `${color.bg} ${color.hoverBg}`
                              }`}>
                              <div className="flex-1">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${isExpanded ? color.label : "text-slate-400"}`}>
                                  Ch {String(index + 1).padStart(2, "0")}
                                </span>
                                <p className={`mt-0.5 text-sm font-semibold leading-snug ${isExpanded ? color.title : "text-slate-700"}`}>
                                  {chapter.title}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isAdmin && (
                                  <span onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-500 hover:text-white cursor-pointer"
                                    title="Delete chapter">
                                    <Trash2 className="h-3 w-3" />
                                  </span>
                                )}
                                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? "rotate-180 text-violet-500" : ""}`} />
                              </div>
                            </button>

                            {/* Accordion body */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div key="content" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
                                  <div className="border-t border-violet-100 p-4 space-y-4">
                                    {isLoading ? (
                                      <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-xs">Loading chapter content�</span>
                                      </div>
                                    ) : (
                                      <>
                                        {/* -- MCQs -- */}
                                        <div>
                                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100">
                                              <ListChecks className="h-3 w-3 text-emerald-600" />
                                            </span>
                                            MCQs
                                            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{mcqs.length} loaded</span>
                                          </h4>
                                          {mcqs.length === 0 ? (
                                            <p className="text-xs text-slate-400">No MCQs added yet.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {mcqs.map((mcq, qi) => (
                                                <div key={mcq.id} className="rounded-lg border border-emerald-50 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 p-2">
                                                  <div className="flex items-start gap-1">
                                                    <div className="flex-1">
                                                      <p className="text-xs font-semibold text-slate-800">Q{qi + 1}. {mcq.question}</p>
                                                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-slate-600">
                                                        {(["A", "B", "C", "D"] as const).map((opt) => (
                                                          <span key={opt}
                                                            className={`rounded px-1.5 py-0.5 font-medium ${mcq.correct_answer === opt ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                                                            {opt}. {mcq[`option_${opt.toLowerCase()}` as keyof MCQ] as string}
                                                          </span>
                                                        ))}
                                                      </div>
                                                      {mcq.explanation && <p className="mt-1 text-[10px] italic text-slate-400 line-clamp-2">{mcq.explanation}</p>}
                                                    </div>
                                                    {isAdmin && <DelBtn onClick={() => deleteMCQ(mcq.id, chapter.id)} />}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {hasMoreMcqs && (
                                            <button type="button" onClick={() => loadMoreMCQs(chapter.id)} disabled={isMcqLoading}
                                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">
                                              {isMcqLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Loading�</> : "Load More MCQs"}
                                            </button>
                                          )}

                                          {/* Admin: Add MCQ + CSV */}
                                          {isAdmin && (
                                            <>
                                              <InlineForm label="Add MCQ" show={showAddMCQFor === chapter.id}
                                                onToggle={() => { setShowAddMCQFor(showAddMCQFor === chapter.id ? null : chapter.id); }}
                                                onSubmit={(e) => addMCQ(e, chapter.id)} busy={busy}>
                                                <SmallInput placeholder="Question" value={mcqQ} onChange={(e) => setMcqQ(e.target.value)} />
                                                <div className="grid grid-cols-2 gap-1.5">
                                                  <SmallInput placeholder="Option A" value={mcqA} onChange={(e) => setMcqA(e.target.value)} />
                                                  <SmallInput placeholder="Option B" value={mcqB} onChange={(e) => setMcqB(e.target.value)} />
                                                  <SmallInput placeholder="Option C" value={mcqC} onChange={(e) => setMcqC(e.target.value)} />
                                                  <SmallInput placeholder="Option D" value={mcqD} onChange={(e) => setMcqD(e.target.value)} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-[10px] font-bold text-slate-500">Correct:</span>
                                                  {(["A","B","C","D"] as const).map((opt) => (
                                                    <button key={opt} type="button" onClick={() => setMcqCorrect(opt)}
                                                      className={`h-6 w-6 rounded text-[10px] font-bold transition ${mcqCorrect === opt ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                                                      {opt}
                                                    </button>
                                                  ))}
                                                </div>
                                                <SmallTextarea placeholder="Explanation (optional)" value={mcqExpl} onChange={(e) => setMcqExpl(e.target.value)} />
                                              </InlineForm>

                                              {/* CSV Upload button */}
                                              <input ref={csvRef} type="file" accept=".csv" className="hidden"
                                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVUpload(chapter.id, f); }} />
                                              <button type="button"
                                                onClick={() => csvRef.current?.click()}
                                                className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-emerald-300 py-1.5 text-[10px] font-bold text-emerald-600 transition hover:bg-emerald-50">
                                                <Upload className="h-3 w-3" /> Upload MCQs CSV
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      });
                      })()}
                    </div>
                  )}

                  {/* Admin: Add Chapter */}
                  {isAdmin && (
                    <InlineForm label="Add Chapter" show={showAddChapter}
                      onToggle={() => { setShowAddChapter(!showAddChapter); setAddChapterTitle(""); }}
                      onSubmit={addChapter} busy={busy}>
                      <SmallInput placeholder="Chapter title" value={addChapterTitle} onChange={(e) => setAddChapterTitle(e.target.value)} autoFocus />
                    </InlineForm>
                  )}
                </div>
              </motion.div>

              {/* ------ RIGHT COLUMN ------ */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.08, ease: "easeOut" }} className="space-y-5">

                {/* Subject Notes */}
                <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-100/30">
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white"><FileText className="h-4 w-4" /> Subject Notes</h3>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Admin uploaded PDFs */}
                      {isAdmin && userNotes.length > 0 && (
                        <>
                          <div className="border-t border-violet-100 pt-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-2">Uploaded PDFs</p>
                          </div>
                          <div className="space-y-2">
                            {userNotes.map((un) => (
                              <div key={un.id} className="flex items-center gap-2.5 rounded-xl border border-violet-50 bg-gradient-to-r from-violet-50/60 to-purple-50/60 p-2.5 transition hover:bg-violet-100/50">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                                  <FileText className="h-3.5 w-3.5 text-violet-600" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">{un.title}</p>
                                  <button type="button"
                                    onClick={() => viewUserNotePdf(un.id)}
                                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-violet-600">
                                    View <Eye className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                                <button type="button" onClick={() => deleteUserNote(un.id)} title="Delete"
                                  className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-500 hover:text-white">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Non-admin: show uploaded PDFs as view-only (no delete) */}
                      {!isAdmin && userNotes.length > 0 && (
                        <>
                          <div className="border-t border-violet-100 pt-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400 mb-2">PDF Notes</p>
                          </div>
                          <div className="space-y-2">
                            {userNotes.map((un) => (
                              <div key={un.id} className="flex items-center gap-2.5 rounded-xl border border-violet-50 bg-gradient-to-r from-violet-50/60 to-purple-50/60 p-2.5 transition hover:bg-violet-100/50">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                                  <FileText className="h-3.5 w-3.5 text-violet-600" />
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800 truncate">{un.title}</p>
                                  <button type="button"
                                    onClick={() => viewUserNotePdf(un.id)}
                                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-violet-600">
                                    View <Eye className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Upload PDF form – admin only */}
                      {isAdmin && (
                        <>
                      {!showAddUserNote ? (
                        <button type="button" onClick={() => setShowAddUserNote(true)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-violet-300 py-1.5 text-[10px] font-bold text-violet-500 transition hover:bg-violet-50">
                          <Plus className="h-3 w-3" /> Upload PDF Note
                        </button>
                      ) : (
                        <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                          onSubmit={uploadUserNote} className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                          <SmallInput placeholder="Note title" value={userNoteTitle} onChange={(e) => setUserNoteTitle(e.target.value)} autoFocus />
                          <input type="file" accept=".pdf" onChange={(e) => setUserNoteFile(e.target.files?.[0] ?? null)}
                            className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-700 hover:file:bg-violet-200" />
                          <div className="flex gap-2">
                            <button type="submit" disabled={userNoteBusy || !userNoteTitle.trim() || !userNoteFile}
                              className="flex-1 rounded-lg bg-violet-600 py-1.5 text-[10px] font-bold text-white transition hover:bg-violet-700 disabled:opacity-50">
                              {userNoteBusy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Upload"}
                            </button>
                            <button type="button" onClick={() => { setShowAddUserNote(false); setUserNoteTitle(""); setUserNoteFile(null); }}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white">
                              Cancel
                            </button>
                          </div>
                        </motion.form>
                      )}
                        </>
                      )}

                      {userNotes.length === 0 && (
                        <p className="text-xs text-slate-400">No PDF notes yet.</p>
                      )}
                    </div>
                  </div>

                {/* Past Papers */}
                <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-lg shadow-orange-100/30">
                  <div className="bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Flame className="h-4 w-4" /> Past Papers</h3>
                  </div>
                  <div className="p-4">
                    {subjectPapers.length === 0 ? (
                      <p className="text-xs text-slate-400">No past papers yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectPapers.slice(0, 6).map((paper) => {
                          const href = resolveLink(paper.file_path);
                          return (
                            <div key={paper.id} className="flex items-start gap-2 rounded-xl border border-orange-50 bg-gradient-to-r from-orange-50/70 to-rose-50/70 p-2.5">
                              <div className="flex-1">
                                <p className="text-xs font-semibold text-slate-800">{paper.title}</p>
                                <div className="mt-1.5 flex items-center gap-2">
                                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">{readYear(paper.title)}</span>
                                  {href && (
                                    <button type="button"
                                      className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-orange-600"
                                      onClick={() => setPdfViewerUrl(href)}>
                                      View <Eye className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isAdmin && <DelBtn onClick={() => deletePaper(paper.id)} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isAdmin && (
                      <InlineForm label="Add Past Paper" show={showAddPaper}
                        onToggle={() => { setShowAddPaper(!showAddPaper); setPaperTitle(""); setPaperUrl(""); setPaperFile(null); }}
                        onSubmit={addPaper} busy={busy}>
                        <SmallInput placeholder="Paper title (include year)" value={paperTitle} onChange={(e) => setPaperTitle(e.target.value)} />
                        <SmallInput placeholder="URL (optional if uploading file)" value={paperUrl} onChange={(e) => setPaperUrl(e.target.value)} />
                        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)}
                          className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-orange-700 hover:file:bg-orange-200" />
                      </InlineForm>
                    )}
                  </div>
                </div>

                {/* Resources */}
                <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-lg shadow-sky-100/30">
                  <div className="bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Globe className="h-4 w-4" /> Resources</h3>
                  </div>
                  <div className="p-4">
                    {subjectResources.length === 0 && !isAdmin ? (
                      <p className="text-xs text-slate-400">No resources yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectResources.map((res) => {
                          const href = resolveLink(res.url);
                          return (
                            <div key={res.id} className="flex items-start gap-2 rounded-xl border border-sky-50 bg-gradient-to-r from-sky-50/60 to-blue-50/60 p-2.5">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                                <Link2 className="h-3 w-3 text-sky-600" />
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800">{res.title}</p>
                                {href ? (
                                  <a className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-sky-700"
                                    href={href} target="_blank" rel="noreferrer">
                                    Open <Download className="h-2.5 w-2.5" />
                                  </a>
                                ) : (
                                  <p className="mt-1 text-xs text-slate-500 truncate">{res.url}</p>
                                )}
                              </div>
                              {isAdmin && <DelBtn onClick={() => deleteSubjectResource(res.id)} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {isAdmin && (
                      <InlineForm label="Add Resource Link" show={showAddSubjRes}
                        onToggle={() => { setShowAddSubjRes(!showAddSubjRes); setSubjResTitle(""); setSubjResUrl(""); }}
                        onSubmit={addSubjectResource} busy={busy}>
                        <SmallInput placeholder="Title (e.g. Khan Academy - Physics)" value={subjResTitle} onChange={(e) => setSubjResTitle(e.target.value)} />
                        <SmallInput placeholder="URL (https://...)" value={subjResUrl} onChange={(e) => setSubjResUrl(e.target.value)} />
                      </InlineForm>
                    )}
                  </div>
                </div>

                {/* Tips & Tricks */}
                <div className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-lg shadow-teal-100/30">
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white"><Lightbulb className="h-4 w-4" /> Tips &amp; Tricks</h3>
                  </div>
                  <div className="p-4">
                    {subjectTips.length === 0 && !isAdmin ? (
                      <p className="text-xs text-slate-400">No tips yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectTips.map((tip) => (
                          <div key={tip.id} className="flex items-start gap-2 rounded-xl border border-teal-50 bg-gradient-to-r from-teal-50/60 to-cyan-50/60 p-2.5">
                            <span className="mt-0.5 text-base">??</span>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-teal-800">{tip.title}</p>
                              <p className="mt-0.5 text-xs text-slate-600 line-clamp-4">{tip.content}</p>
                            </div>
                            {isAdmin && <DelBtn onClick={() => deleteTip(tip.id)} />}
                          </div>
                        ))}
                      </div>
                    )}
                    {isAdmin && (
                      <InlineForm label="Add Tip" show={showAddTip}
                        onToggle={() => { setShowAddTip(!showAddTip); setTipTitle(""); setTipContent(""); }}
                        onSubmit={addTip} busy={busy}>
                        <SmallInput placeholder="Tip title" value={tipTitle} onChange={(e) => setTipTitle(e.target.value)} />
                        <SmallTextarea placeholder="Tip content" value={tipContent} onChange={(e) => setTipContent(e.target.value)} />
                      </InlineForm>
                    )}
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* ── PDF Viewer Modal (past papers) ── */}
      <AnimatePresence>
        {pdfViewerUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPdfViewerUrl(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl will-change-transform"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <h3 className="text-sm font-bold text-slate-800">PDF Viewer</h3>
                <button type="button" onClick={() => setPdfViewerUrl(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe src={`${pdfViewerUrl}#toolbar=0&navpanes=0`} className="flex-1 w-full" title="PDF Viewer" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User Note PDF Viewer Modal (view-only, no download) ── */}
      <AnimatePresence>
        {userNotePdfUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setUserNotePdfUrl(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl will-change-transform"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 px-5 py-3">
                <h3 className="text-sm font-bold text-violet-800">My Note — View Only</h3>
                <button type="button" onClick={() => setUserNotePdfUrl(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-violet-500 transition hover:bg-violet-200 hover:text-violet-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <iframe src={`${userNotePdfUrl}#toolbar=0&navpanes=0`} className="flex-1 w-full" title="User Note PDF Viewer" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default USATSubjectChapters;

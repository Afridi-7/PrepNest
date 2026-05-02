import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ChevronDown, Download, Eye, FileText, Flame, Globe, Layers,
  Lightbulb, Link2, ListChecks, Loader2, Lock, Plus, Trash2, Upload, X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import ContentProtection from "@/components/ContentProtection";
import { apiClient, MCQ, PastPaper, Subject, SubjectResource, Tip, Topic, UserNote, API_ORIGIN, API_BASE_URL } from "@/services/api";

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* ── Module-level cache ─────────────────────────────────────────────────
 * Keeps the bulk payload alive across navigations so going Dashboard →
 * Subject → back → Subject re-renders instantly from memory rather than
 * re-fetching. Entries expire after 5 min (matches backend Redis TTL) so
 * admins still see updates within a few minutes.
 */
type BulkPayload = {
  subject: Subject;
  chapters: Topic[];
  papers: PastPaper[];
  tips: Tip[];
  resources: SubjectResource[];
  user_notes: UserNote[];
};
const _BULK_TTL_MS = 5 * 60_000;
const _bulkCache = new Map<string, { data: BulkPayload; expiresAt: number }>();
const _bulkCacheGet = (key: string): BulkPayload | null => {
  const hit = _bulkCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) { _bulkCache.delete(key); return null; }
  return hit.data;
};
const _bulkCacheSet = (key: string, data: BulkPayload) =>
  _bulkCache.set(key, { data, expiresAt: Date.now() + _BULK_TTL_MS });
export const invalidateSubjectBulkCache = (category?: string, subject?: string) => {
  if (category && subject) _bulkCache.delete(`${category}|${subject}`);
  else _bulkCache.clear();
};

const resolveLink = (value: string): string | null => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("/storage/v1/object/")) {
      const token = apiClient.getToken();
      if (!token) return trimmed;
      return `${API_BASE_URL}/files/proxy?url=${encodeURIComponent(trimmed)}&token=${encodeURIComponent(token)}`;
    }
    return trimmed;
  }
  if (trimmed.startsWith("/uploads/")) return `${API_ORIGIN}${trimmed}`;
  return null;
};

/**
 * Resolve a file URL to one the PDF iframe can load directly.
 *
 * Supabase Storage objects → short-lived signed URL (~50 ms backend call);
 * the iframe loads the PDF straight from Supabase CDN, no file data passes
 * through our backend.
 *
 * Local /uploads/ paths → direct same-origin URL (served by backend).
 */
const resolvePdfUrl = async (fileUrl: string): Promise<string> => {
  const token = apiClient.getToken();
  if (!token) throw new Error("Not authenticated");

  if (fileUrl.includes("/storage/v1/object/")) {
    // Ask backend for a time-limited signed URL (small JSON, no file bytes)
    const res = await fetch(
      `${API_BASE_URL}/files/signed-url?url=${encodeURIComponent(fileUrl)}&token=${encodeURIComponent(token)}`
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Could not get download URL (${res.status}): ${body.slice(0, 200)}`);
    }
    const { signed_url } = (await res.json()) as { signed_url: string };
    // The iframe loads directly from Supabase CDN — no CORS, no backend hop
    return signed_url;
  }

  if (fileUrl.startsWith("/uploads/")) {
    return `${API_ORIGIN}${fileUrl}`;
  }

  return fileUrl;
};

const readYear = (title: string): string => {
  const match = title.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : "N/A";
};

const MCQ_PAGE_SIZE = 20;

/* ── Chapter color palette — vivid gradient cards with high-contrast text ── */
type ChapterPalette = {
  /* Collapsed (full-color) state */
  cardGradient: string;       // full-card gradient bg when collapsed
  cardBorder: string;         // collapsed border
  cardShadow: string;         // collapsed shadow tint
  cardHoverShadow: string;    // hover shadow tint (stronger)
  /* Expanded state */
  expandedBg: string;         // soft tinted body
  expandedBorder: string;     // accent border (top of body + outer)
  expandedShadow: string;
  /* Pieces inside the card header */
  badge: string;              // round number chip (white pill on gradient)
  badgeText: string;
  mcqPill: string;            // "12 MCQs" pill on collapsed (translucent white)
  mcqPillExpanded: string;    // pill style when expanded
  labelText: string;          // "Chapter N" small text on collapsed (always white-ish)
  titleCollapsed: string;     // chapter title color when collapsed
  titleExpanded: string;      // chapter title color when expanded
  chevronCollapsed: string;
  chevronExpanded: string;
  /* Section pieces inside the expanded body */
  sectionAccent: string;      // small accent chip color (e.g. emerald)
};

const CHAPTER_COLORS: ChapterPalette[] = (() => {
  // Muted, professional accent palette — each card uses a soft neutral base
  // with a single restrained accent color. No candy gradients, no childish vibes.
  type Accent = { name: string; tintBg: string; tintBorder: string; deep: string; mid: string; soft: string; softText: string; badgeBg: string };
  const accents: Accent[] = [
    { name: "slate",   tintBg: "from-white via-slate-50 to-slate-100/70",       tintBorder: "border-slate-200",   deep: "text-slate-900",   mid: "text-slate-600",   soft: "bg-slate-100",    softText: "text-slate-700",   badgeBg: "bg-slate-700" },
    { name: "steel",   tintBg: "from-white via-slate-50 to-blue-50/60",         tintBorder: "border-slate-200",   deep: "text-slate-900",   mid: "text-slate-600",   soft: "bg-blue-50",      softText: "text-blue-800",    badgeBg: "bg-blue-700" },
    { name: "sage",    tintBg: "from-white via-slate-50 to-emerald-50/60",      tintBorder: "border-emerald-100", deep: "text-emerald-900", mid: "text-emerald-700", soft: "bg-emerald-50",   softText: "text-emerald-800", badgeBg: "bg-emerald-700" },
    { name: "sand",    tintBg: "from-white via-stone-50 to-amber-50/60",        tintBorder: "border-stone-200",   deep: "text-stone-900",   mid: "text-stone-600",   soft: "bg-amber-50",     softText: "text-amber-800",   badgeBg: "bg-amber-700" },
    { name: "mauve",   tintBg: "from-white via-slate-50 to-rose-50/60",         tintBorder: "border-rose-100",    deep: "text-rose-900",    mid: "text-rose-700",    soft: "bg-rose-50",      softText: "text-rose-800",    badgeBg: "bg-rose-700" },
    { name: "indigo",  tintBg: "from-white via-slate-50 to-indigo-50/60",       tintBorder: "border-indigo-100",  deep: "text-indigo-900",  mid: "text-indigo-700",  soft: "bg-indigo-50",    softText: "text-indigo-800",  badgeBg: "bg-indigo-700" },
    { name: "teal",    tintBg: "from-white via-slate-50 to-teal-50/60",         tintBorder: "border-teal-100",    deep: "text-teal-900",    mid: "text-teal-700",    soft: "bg-teal-50",      softText: "text-teal-800",    badgeBg: "bg-teal-700" },
    { name: "plum",    tintBg: "from-white via-slate-50 to-violet-50/60",       tintBorder: "border-violet-100",  deep: "text-violet-900",  mid: "text-violet-700",  soft: "bg-violet-50",    softText: "text-violet-800",  badgeBg: "bg-violet-700" },
    { name: "slate2",  tintBg: "from-white via-zinc-50 to-slate-100/70",        tintBorder: "border-zinc-200",    deep: "text-zinc-900",    mid: "text-zinc-600",    soft: "bg-zinc-100",     softText: "text-zinc-700",    badgeBg: "bg-zinc-700" },
    { name: "forest",  tintBg: "from-white via-slate-50 to-green-50/60",        tintBorder: "border-green-100",   deep: "text-green-900",   mid: "text-green-700",   soft: "bg-green-50",     softText: "text-green-800",   badgeBg: "bg-green-700" },
    { name: "dusk",    tintBg: "from-white via-slate-50 to-sky-50/60",          tintBorder: "border-sky-100",     deep: "text-sky-900",     mid: "text-sky-700",     soft: "bg-sky-50",       softText: "text-sky-800",     badgeBg: "bg-sky-700" },
    { name: "clay",    tintBg: "from-white via-stone-50 to-orange-50/60",       tintBorder: "border-stone-200",   deep: "text-stone-900",   mid: "text-stone-600",   soft: "bg-orange-50",    softText: "text-orange-800",  badgeBg: "bg-orange-700" },
  ];
  return accents.map((a) => ({
    cardGradient: `bg-gradient-to-br ${a.tintBg}`,
    cardBorder: a.tintBorder,
    cardShadow: "shadow-sm shadow-slate-200/40",
    cardHoverShadow: "hover:shadow-md hover:shadow-slate-300/40",
    expandedBg: "bg-white",
    expandedBorder: a.tintBorder,
    expandedShadow: "shadow-slate-200/40",
    badge: a.badgeBg,
    badgeText: "text-white",
    mcqPill: `bg-white ${a.softText} border ${a.tintBorder}`,
    mcqPillExpanded: "bg-slate-800 text-white",
    labelText: a.mid,
    titleCollapsed: a.deep,
    titleExpanded: "text-slate-900",
    chevronCollapsed: "text-slate-400",
    chevronExpanded: "text-slate-600",
    sectionAccent: `${a.soft} ${a.softText}`,
  }));
})();

/* ── Tiny reusable components ─────────────────────────────────────────── */
const InlineForm = ({
  label, show, onToggle, onSubmit, busy, children,
}: {
  label: string; show: boolean; onToggle: () => void;
  onSubmit: (e: FormEvent) => void; busy: boolean; children: React.ReactNode;
}) => (
  <>
    {!show && (
      <button type="button" onClick={onToggle}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 py-2 text-[11px] font-bold text-blue-500 transition hover:bg-blue-50 hover:border-blue-400">
        <Plus className="h-3 w-3" /> {label}
      </button>
    )}
    {show && (
      <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
        onSubmit={onSubmit} className="mt-2 space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
        {children}
        <div className="flex gap-2">
          <button type="submit" disabled={busy}
            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 py-1.5 text-[10px] font-bold text-white transition hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50">
            {busy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Save"}
          </button>
          <button type="button" onClick={onToggle}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white transition">
            Cancel
          </button>
        </div>
      </motion.form>
    )}
  </>
);

const SmallInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 transition ${props.className ?? ""}`} />
);

const SmallTextarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-200 transition ${props.className ?? ""}`} rows={2} />
);

const DelBtn = ({ onClick, title }: { onClick: () => void; title?: string }) => (
  <button type="button" onClick={onClick} title={title ?? "Delete"}
    className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-500 hover:text-white">
    <Trash2 className="h-3 w-3" />
  </button>
);

/* ── Section card wrapper ─────────────────────────────────────────────── */
const SectionCard = ({
  headerGradient, icon, title, children,
  borderColor = "border-slate-100", shadowColor = "shadow-slate-100/30",
}: {
  headerGradient: string; icon: React.ReactNode; title: string; children: React.ReactNode;
  borderColor?: string; shadowColor?: string;
}) => (
  <div className={`overflow-hidden rounded-2xl border ${borderColor} bg-white shadow-lg ${shadowColor}`}>
    <div className={`${headerGradient} px-5 py-3.5 flex items-center gap-2`}>
      {icon}
      <h3 className="text-sm font-bold text-white">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

/* ====================================================================== */

const USATSubjectChapters = () => {
  const { category = "", subject = "" } = useParams();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Topic[]>([]);
  const [subjectPapers, setSubjectPapers] = useState<PastPaper[]>([]);
  const [subjectTips, setSubjectTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userNotes, setUserNotes] = useState<UserNote[]>([]);
  const [showAddUserNote, setShowAddUserNote] = useState(false);
  const [userNoteTitle, setUserNoteTitle] = useState("");
  const [userNoteFile, setUserNoteFile] = useState<File | null>(null);
  const [userNoteBusy, setUserNoteBusy] = useState(false);
  const [userNotePdfUrl, setUserNotePdfUrl] = useState<string | null>(null);
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(null);
  const [chapterMcqsById, setChapterMcqsById] = useState<Record<number, MCQ[]>>({});
  const [chapterLoadingById, setChapterLoadingById] = useState<Record<number, boolean>>({});
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [userNotePdfLoading, setUserNotePdfLoading] = useState(false);
  const [userNotePdfError, setUserNotePdfError] = useState<string | null>(null);
  const [subjectResources, setSubjectResources] = useState<SubjectResource[]>([]);
  const [showAddSubjRes, setShowAddSubjRes] = useState(false);
  const [subjResTitle, setSubjResTitle] = useState("");
  const [subjResUrl, setSubjResUrl] = useState("");
  const fetchedRef = useRef(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient.checkIsAdmin().then(setIsAdmin).catch(() => {});
    apiClient.checkIsPro().then(setIsPro).catch(() => {});
  }, []);

  const lastFetchKey = useRef("");

  useEffect(() => {
    const key = `${category}|${subject}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;
    if (!category || !subject) return;

    // ── Instant render from module cache when available ──
    // Eliminates the full-page skeleton on revisit. We still revalidate
    // in the background so any admin edits show up within the TTL window.
    const cached = _bulkCacheGet(key);
    if (cached) {
      setSubjectInfo(cached.subject);
      setChapters(cached.chapters);
      setSubjectPapers(cached.papers);
      setSubjectTips(cached.tips);
      setSubjectResources(cached.resources);
      setUserNotes(cached.user_notes);
      setLoading(false);
      return; // backend Redis cache (5 min TTL) handles freshness on next nav
    }

    setLoading(true);
    (async () => {
      const bulk = await apiClient.getSubjectBulkData(category, subject);
      _bulkCacheSet(key, bulk);
      setSubjectInfo(bulk.subject);
      setChapters(bulk.chapters);
      setSubjectPapers(bulk.papers);
      setSubjectTips(bulk.tips);
      setSubjectResources(bulk.resources);
      setUserNotes(bulk.user_notes);
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
    } finally {
      setChapterLoadingById((prev) => ({ ...prev, [chapterId]: false }));
    }
  }, [chapterLoadingById, chapterMcqsById]);

  const toggleChapter = useCallback((chapterId: number) => {
    if (expandedChapterId === chapterId) { setExpandedChapterId(null); return; }
    setExpandedChapterId(chapterId);
    loadChapterData(chapterId).catch(() => {});
    setTimeout(() => {
      document.getElementById(`chapter-${chapterId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [expandedChapterId, loadChapterData]);

  /* ── Admin handlers ─────────────────────────────────────────────────── */
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
    if (!apiClient.isAuthenticated()) {
      setShowAuthDialog(true);
      return;
    }
    try {
      setUserNotePdfLoading(true);
      setUserNotePdfError(null);
      const directUrl = await apiClient.getUserNoteDirectUrl(noteId);
      const url = await resolvePdfUrl(directUrl);
      setUserNotePdfUrl(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setUserNotePdfError(msg);
      setUserNotePdfUrl("__error__");
    } finally {
      setUserNotePdfLoading(false);
    }
  };

  // Essay CSV upload (admin only, for essay-type subjects)
  const isEssaySubject = subject.includes("essay");
  const essayCsvRef = useRef<HTMLInputElement>(null);
  const [essayUploadBusy, setEssayUploadBusy] = useState(false);
  const handleEssayCsvUpload = async (file: File) => {
    setEssayUploadBusy(true);
    try {
      const result = await apiClient.uploadEssayCSV(file);
      alert(`Uploaded! ${result.created} created, ${result.skipped} skipped.`);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    } finally {
      setEssayUploadBusy(false);
      if (essayCsvRef.current) essayCsvRef.current.value = "";
    }
  };

  return (
    <>
      <Navbar />
      <ContentProtection>
      <div className="relative min-h-screen overflow-hidden bg-slate-50 pt-24 pb-20 dark:bg-background">

        <div className="container relative z-10 mx-auto px-4">

          {/* ── HERO ── */}
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-8 shadow-xl shadow-blue-500/20">
            <Link to={`/usat/${encodeURIComponent(category)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Subjects
            </Link>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {subjectInfo?.name || "Subject"}
            </h1>
            <p className="mt-1 text-sm font-medium text-blue-200">{category} · Chapters Window</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { label: "Chapters",      value: chapters.length,      color: "bg-white/20 text-white" },
                { label: "PDF Notes",     value: userNotes.length,     color: "bg-cyan-400/30 text-cyan-100" },
                { label: "Past Papers",   value: subjectPapers.length, color: "bg-cyan-400/30 text-cyan-100" },
              ].map((stat) => (
                <div key={stat.label} className={`${stat.color} flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold backdrop-blur-sm`}>
                  <span className="text-xl font-black">{stat.value}</span>
                  <span className="opacity-80">{stat.label}</span>
                </div>
              ))}
            </div>
            {/* dot row */}
            <div className="mt-5 flex gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
              ))}
            </div>
          </motion.section>

          {/* ── LOADING ── */}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">

              {/* ══════════════════════════════════════════════
                  LEFT — ACCORDION CHAPTERS
              ══════════════════════════════════════════════ */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-lg shadow-blue-100/40">
                  <h2 className="mb-5 flex items-center gap-2 text-base font-bold text-blue-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                      <Layers className="h-4 w-4 text-blue-600" />
                    </span>
                    Chapters
                    <span className="ml-auto rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-600">{chapters.length}</span>
                  </h2>

                  {chapters.length === 0 && !isAdmin ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100">
                        <Layers className="h-6 w-6 text-blue-400" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No chapters yet</p>
                      <p className="text-xs text-slate-400 mt-1">Content is being added soon.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(() => {
                        // Per-category offset so the same chapter index in different
                        // categories starts on a different palette color.
                        const CATEGORY_OFFSET: Record<string, number> = {
                          "USAT-E": 0,
                          "USAT-M": 2,
                          "USAT-CS": 6,
                          "USAT-A": 4,
                          "USAT-GS": 3,
                          "USAT-COM": 9,
                        };
                        const offset = CATEGORY_OFFSET[category.toUpperCase()] ?? 0;
                        return chapters.map((chapter, index) => {
                        const isExpanded = expandedChapterId === chapter.id;
                        const mcqs = chapterMcqsById[chapter.id] ?? [];
                        const isLoading = !!chapterLoadingById[chapter.id];
                        const C = CHAPTER_COLORS[(index + offset) % CHAPTER_COLORS.length];

                        return (
                          <div key={chapter.id}
                            id={`chapter-${chapter.id}`}
                            className={`overflow-hidden rounded-2xl border-2 transition-shadow duration-150 ${
                              isExpanded
                                ? `${C.expandedBorder} bg-white shadow-lg ${C.expandedShadow}`
                                : `${C.cardBorder} ${C.cardShadow} ${C.cardHoverShadow} hover:-translate-y-0.5 transition-transform`
                            }`}>

                            {/* Chapter header button */}
                            <button type="button" onClick={() => toggleChapter(chapter.id)}
                              className={`group flex w-full items-center gap-3 p-4 text-left ${
                                isExpanded ? "bg-white" : `${C.cardGradient}`
                              }`}>

                              {/* number chip */}
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-md ${
                                isExpanded ? `${C.mcqPillExpanded}` : `${C.badge} ${C.badgeText} ring-2 ring-white/40`
                              }`}>
                                {String(index + 1).padStart(2, "0")}
                              </div>

                              <div className="flex-1 min-w-0">
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                  isExpanded ? "text-slate-400" : C.labelText
                                }`}>
                                  Chapter {index + 1}
                                </span>
                                <p className={`mt-0.5 text-base font-extrabold leading-snug truncate ${
                                  isExpanded ? C.titleExpanded : C.titleCollapsed
                                }`}>
                                  {chapter.title}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {chapterMcqsById[chapter.id] !== undefined && (
                                  <span className={`hidden sm:inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                    isExpanded ? C.mcqPillExpanded : C.mcqPill
                                  }`}>
                                    {chapterMcqsById[chapter.id].length} MCQs
                                  </span>
                                )}
                                {isAdmin && (
                                  <span onClick={(e) => { e.stopPropagation(); deleteChapter(chapter.id); }}
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-500 hover:text-white cursor-pointer">
                                    <Trash2 className="h-3 w-3" />
                                  </span>
                                )}
                                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform duration-150 ${
                                  isExpanded ? `rotate-180 ${C.chevronExpanded}` : C.chevronCollapsed
                                }`} />
                              </div>
                            </button>

                            {/* Accordion body */}
                            {isExpanded && (
                                <div className="overflow-hidden">
                                  <div className={`border-t-2 ${C.expandedBorder} ${C.expandedBg} p-4 space-y-4`}>
                                    {isLoading ? (
                                      <div className="flex items-center justify-center gap-2 py-6 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-xs font-medium">Loading chapter content…</span>
                                      </div>
                                    ) : (
                                      <div>
                                        {/* MCQs header */}
                                        <div className="mb-3 flex items-center gap-2">
                                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100">
                                            <ListChecks className="h-3.5 w-3.5 text-emerald-600" />
                                          </span>
                                          <h4 className="text-xs font-bold text-emerald-700">MCQs</h4>
                                          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            {mcqs.length} loaded
                                          </span>
                                        </div>

                                        {mcqs.length === 0 ? (
                                          <p className="text-xs text-slate-400 pl-1">No MCQs added yet.</p>
                                        ) : (
                                          <div className="space-y-2">
                                            {mcqs.map((mcq, qi) => (
                                              <div key={mcq.id}
                                                className="rounded-xl border border-white bg-white p-3 shadow-sm">
                                                <div className="flex items-start gap-2">
                                                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-black text-emerald-700">
                                                    {qi + 1}
                                                  </span>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-800 leading-snug">{mcq.question}</p>
                                                    <div className="mt-2 grid grid-cols-2 gap-1">
                                                      {(["A", "B", "C", "D"] as const).map((opt) => (
                                                        <span key={opt}
                                                          className={`rounded-lg px-2 py-1 text-[10px] font-medium leading-tight ${
                                                            mcq.correct_answer === opt
                                                              ? "bg-emerald-500 text-white font-bold"
                                                              : "bg-slate-100 text-slate-600"
                                                          }`}>
                                                          <span className="font-black">{opt}.</span> {mcq[`option_${opt.toLowerCase()}` as keyof MCQ] as string}
                                                        </span>
                                                      ))}
                                                    </div>
                                                    {mcq.explanation && (
                                                      <p className="mt-2 text-[10px] italic text-slate-400 line-clamp-2 bg-slate-50 rounded-lg px-2 py-1">{mcq.explanation}</p>
                                                    )}
                                                  </div>
                                                  {isAdmin && <DelBtn onClick={() => deleteMCQ(mcq.id, chapter.id)} />}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}

                                        {isAdmin && (
                                          <>
                                            <InlineForm label="Add MCQ" show={showAddMCQFor === chapter.id}
                                              onToggle={() => setShowAddMCQFor(showAddMCQFor === chapter.id ? null : chapter.id)}
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
                                                    className={`h-6 w-6 rounded-lg text-[10px] font-bold transition ${mcqCorrect === opt ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                                                    {opt}
                                                  </button>
                                                ))}
                                              </div>
                                              <SmallTextarea placeholder="Explanation (optional)" value={mcqExpl} onChange={(e) => setMcqExpl(e.target.value)} />
                                            </InlineForm>
                                            <input ref={csvRef} type="file" accept=".csv" className="hidden"
                                              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSVUpload(chapter.id, f); }} />
                                            <button type="button" onClick={() => csvRef.current?.click()}
                                              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-300 py-2 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-50 hover:border-emerald-400">
                                              <Upload className="h-3 w-3" /> Upload MCQs CSV
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      });
                      })()}
                    </div>
                  )}

                  {isAdmin && (
                    <InlineForm label="Add Chapter" show={showAddChapter}
                      onToggle={() => { setShowAddChapter(!showAddChapter); setAddChapterTitle(""); }}
                      onSubmit={addChapter} busy={busy}>
                      <SmallInput placeholder="Chapter title" value={addChapterTitle} onChange={(e) => setAddChapterTitle(e.target.value)} autoFocus />
                    </InlineForm>
                  )}

                  {/* Admin: Essay CSV Upload (only on essay subjects) */}
                  {isAdmin && isEssaySubject && (
                    <div className="mt-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Upload Essay Prompts CSV</p>
                      <p className="text-[10px] text-slate-400 mb-2">CSV must have columns: <strong>essay_type</strong>, <strong>prompt_text</strong>, <strong>exam_type</strong> (optional)</p>
                      <input ref={essayCsvRef} type="file" accept=".csv"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEssayCsvUpload(f); }}
                        className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-200" />
                      {essayUploadBusy && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-500">
                          <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* ══════════════════════════════════════════════
                  RIGHT COLUMN
              ══════════════════════════════════════════════ */}
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.08 }} className="space-y-5">

                {/* Subject Notes */}
                <SectionCard
                  headerGradient="bg-gradient-to-r from-blue-500 to-blue-600"
                  icon={<FileText className="h-4 w-4 text-white" />}
                  title="Subject Notes"
                  borderColor="border-blue-100"
                  shadowColor="shadow-blue-100/30"
                >
                  {/* admin view */}
                  {isAdmin && userNotes.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-2">Uploaded PDFs</p>
                      <div className="space-y-2 mb-3">
                        {userNotes.map((un) => (
                          <div key={un.id} className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-200">
                              <FileText className="h-3.5 w-3.5 text-blue-700" />
                            </span>
                            <p className="flex-1 text-xs font-semibold text-slate-800 truncate min-w-0">{un.title}</p>
                            <button type="button" onClick={() => viewUserNotePdf(un.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-blue-700 shrink-0">
                              <Eye className="h-2.5 w-2.5" /> View
                            </button>
                            <DelBtn onClick={() => deleteUserNote(un.id)} />
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {/* non-admin view */}
                  {!isAdmin && userNotes.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {userNotes.map((un) => (
                        <div key={un.id} className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-200">
                            <FileText className="h-3.5 w-3.5 text-blue-700" />
                          </span>
                          <p className="flex-1 text-xs font-semibold text-slate-800 truncate min-w-0">{un.title}</p>
                          <button type="button" onClick={() => viewUserNotePdf(un.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-blue-700 shrink-0">
                            <Eye className="h-2.5 w-2.5" /> View
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {userNotes.length === 0 && <p className="text-xs text-slate-400 mb-2">No PDF notes yet.</p>}
                  {isAdmin && (
                    !showAddUserNote ? (
                      <button type="button" onClick={() => setShowAddUserNote(true)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-blue-300 py-2 text-[11px] font-bold text-blue-500 transition hover:bg-blue-50 hover:border-blue-400">
                        <Plus className="h-3 w-3" /> Upload PDF Note
                      </button>
                    ) : (
                      <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        onSubmit={uploadUserNote} className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                        <SmallInput placeholder="Note title" value={userNoteTitle} onChange={(e) => setUserNoteTitle(e.target.value)} autoFocus />
                        <input type="file" accept=".pdf" onChange={(e) => setUserNoteFile(e.target.files?.[0] ?? null)}
                          className="w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-200" />
                        <div className="flex gap-2">
                          <button type="submit" disabled={userNoteBusy || !userNoteTitle.trim() || !userNoteFile}
                            className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 py-1.5 text-[10px] font-bold text-white transition disabled:opacity-50">
                            {userNoteBusy ? <Loader2 className="mx-auto h-3 w-3 animate-spin" /> : "Upload"}
                          </button>
                          <button type="button" onClick={() => { setShowAddUserNote(false); setUserNoteTitle(""); setUserNoteFile(null); }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-500 hover:bg-white">Cancel</button>
                        </div>
                      </motion.form>
                    )
                  )}
                </SectionCard>

                {/* Past Papers */}
                <SectionCard
                  headerGradient="bg-gradient-to-r from-orange-500 to-rose-500"
                  icon={<Flame className="h-4 w-4 text-white" />}
                  title="Past Papers"
                  borderColor="border-orange-100"
                  shadowColor="shadow-orange-100/30"
                >
                  {!isPro && !isAdmin ? (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <Lock className="h-6 w-6 text-amber-500" />
                      <p className="text-sm font-bold text-slate-700">Pro Feature</p>
                      <p className="text-xs text-slate-400 text-center">Past papers are available for Pro users only. Upgrade to unlock!</p>
                    </div>
                  ) : subjectPapers.length === 0 ? (
                    <p className="text-xs text-slate-400 mb-2">No past papers yet.</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {subjectPapers.slice(0, 6).map((paper) => {
                        return (
                          <div key={paper.id} className="flex items-start gap-2.5 rounded-xl border border-orange-100 bg-orange-50 p-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{paper.title}</p>
                              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                                <span className="rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-800">{readYear(paper.title)}</span>
                                {paper.file_path && (
                                  <button
                                    type="button"
                                    disabled={pdfLoading}
                                    onClick={async () => {
                                      try {
                                        setPdfLoading(true);
                                        setPdfError(null);
                                        const url = await resolvePdfUrl(paper.file_path);
                                        setPdfViewerUrl(url);
                                      } catch (err: unknown) {
                                        const msg = err instanceof Error ? err.message : "Unknown error";
                                        setPdfError(msg);
                                        setPdfViewerUrl("__error__");
                                      } finally {
                                        setPdfLoading(false);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-orange-600 disabled:opacity-60">
                                    <Eye className="h-2.5 w-2.5" /> {pdfLoading ? "Loading…" : "View"}
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
                </SectionCard>

                {/* Resources */}
                <SectionCard
                  headerGradient="bg-gradient-to-r from-sky-500 to-blue-600"
                  icon={<Globe className="h-4 w-4 text-white" />}
                  title="Resources"
                  borderColor="border-sky-100"
                  shadowColor="shadow-sky-100/30"
                >
                  {subjectResources.length === 0 && !isAdmin ? (
                    <p className="text-xs text-slate-400 mb-2">No resources yet.</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {subjectResources.map((res) => {
                        const href = resolveLink(res.url);
                        return (
                          <div key={res.id} className="flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50 p-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-200">
                              <Link2 className="h-3.5 w-3.5 text-sky-700" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 truncate">{res.title}</p>
                              {href ? (
                                <a href={href} target="_blank" rel="noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-600 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-sky-700">
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
                </SectionCard>

                {/* Tips & Tricks */}
                <SectionCard
                  headerGradient="bg-gradient-to-r from-teal-500 to-cyan-500"
                  icon={<Lightbulb className="h-4 w-4 text-white" />}
                  title="Tips & Tricks"
                  borderColor="border-teal-100"
                  shadowColor="shadow-teal-100/30"
                >
                  {subjectTips.length === 0 && !isAdmin ? (
                    <p className="text-xs text-slate-400 mb-2">No tips yet.</p>
                  ) : (
                    <div className="space-y-2 mb-2">
                      {subjectTips.map((tip) => (
                        <div key={tip.id} className="flex items-start gap-2.5 rounded-xl border border-teal-100 bg-teal-50 p-2.5">
                          <span className="mt-0.5 text-base shrink-0">💡</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-teal-800">{tip.title}</p>
                            <p className="mt-0.5 text-xs text-slate-600 line-clamp-4 leading-relaxed">{tip.content}</p>
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
                </SectionCard>

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
            onClick={() => { setPdfViewerUrl(null); setPdfError(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl will-change-transform"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
                <h3 className="text-sm font-bold text-slate-800">PDF Viewer</h3>
                <button type="button" onClick={() => { setPdfViewerUrl(null); setPdfError(null); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-rose-100 hover:text-rose-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {pdfError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p className="text-sm font-semibold text-rose-600">Could not load PDF</p>
                  <p className="text-xs text-slate-500 max-w-sm">{pdfError}</p>
                </div>
              ) : (
                <iframe src={`${pdfViewerUrl}#toolbar=0&navpanes=0`} className="flex-1 w-full" title="PDF Viewer" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── User Note PDF Viewer Modal ── */}
      <AnimatePresence>
        {userNotePdfUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => { setUserNotePdfUrl(null); setUserNotePdfError(null); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="relative flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl will-change-transform"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-blue-100 bg-gradient-to-r from-blue-50 to-blue-50 px-5 py-3">
                <h3 className="text-sm font-bold text-blue-800">My Note — View Only</h3>
                <button type="button" onClick={() => { setUserNotePdfUrl(null); setUserNotePdfError(null); }}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-500 transition hover:bg-rose-100 hover:text-rose-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {userNotePdfLoading ? (
                <div className="flex-1 flex items-center justify-center text-sm text-slate-400">Loading PDF…</div>
              ) : userNotePdfError ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <p className="text-sm font-semibold text-rose-600">Could not load note PDF</p>
                  <p className="text-xs text-slate-500 max-w-sm">{userNotePdfError}</p>
                </div>
              ) : (
                <iframe src={`${userNotePdfUrl}#toolbar=0&navpanes=0`} className="flex-1 w-full" title="User Note PDF Viewer" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </ContentProtection>
      <AuthRequiredDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        message="Please log in to view subject notes."
      />
    </>
  );
};

export default USATSubjectChapters;
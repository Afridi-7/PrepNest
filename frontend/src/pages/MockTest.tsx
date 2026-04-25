import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ArrowRight, ArrowLeft, Play, Target, BookOpen, AlertCircle,
  Loader2, ChevronDown, CheckCircle2, XCircle, FileText, Send,
  RotateCcw, Award, BarChart3, MessageSquare, PenLine, Lock,
  TrendingUp, AlertTriangle, Lightbulb, Sparkles, Star,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import ContentProtection from "@/components/ContentProtection";
import {
  apiClient,
  type USATCategory,
  type MockTestGenerated,
  type MockTestSection,
  type MockTestMCQQuestion,
  type MockTestEssayQuestion,
  type MockTestResult,
} from "@/services/api";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";

/* ── Helpers ── */
const LETTER = ["A", "B", "C", "D"];

const isMCQ = (q: MockTestMCQQuestion | MockTestEssayQuestion): q is MockTestMCQQuestion =>
  "options" in q;

const formatTime = (s: number) =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

const OPTION_COLORS = [
  {
    idle: "bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400",
    active: "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200",
  },
  {
    idle: "bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100 hover:border-violet-400",
    active: "bg-violet-600 text-white border-violet-600 shadow-violet-200",
  },
  {
    idle: "bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100 hover:border-teal-400",
    active: "bg-teal-600 text-white border-teal-600 shadow-teal-200",
  },
  {
    idle: "bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100 hover:border-orange-400",
    active: "bg-orange-500 text-white border-orange-500 shadow-orange-200",
  },
];

type Phase = "config" | "loading" | "test" | "submitting" | "result";

interface FlatItem {
  sectionIdx: number;
  questionIdx: number;
  type: "mcq" | "essay";
  id: number;
}

const MockTestPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("config");

  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<USATCategory | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const [mockTest, setMockTest] = useState<MockTestGenerated | null>(null);
  const [flatItems, setFlatItems] = useState<FlatItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState("");

  const [result, setResult] = useState<MockTestResult | null>(null);

  const fetchedRef = useRef(false);
  const TIME_LIMIT_MINUTES = 120;
  const [isPro, setIsPro] = useState(true);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient.listUSATCategories().then(setCategories).catch(() => {});
    apiClient.checkIsPro().then(setIsPro).catch(() => setIsPro(false));
    const cat = searchParams.get("category");
    if (cat) {
      apiClient.listUSATCategories().then((cats) => {
        const found = cats.find((c) => c.code === cat.toUpperCase());
        if (found) setSelectedCategory(found);
      });
    }
  }, [searchParams]);

  const buildFlatItems = (sections: MockTestSection[]): FlatItem[] => {
    const items: FlatItem[] = [];
    sections.forEach((sec, si) => {
      sec.questions.forEach((q, qi) => {
        items.push({ sectionIdx: si, questionIdx: qi, type: sec.type as "mcq" | "essay", id: q.id });
      });
    });
    return items;
  };

  const startTest = async () => {
    if (!apiClient.isAuthenticated()) { setAuthDialogOpen(true); return; }
    if (!selectedCategory) return;
    setPhase("loading");
    setError("");
    try {
      const data = await apiClient.generateMockTest(selectedCategory.code);
      setMockTest(data);
      const flat = buildFlatItems(data.sections);
      setFlatItems(flat);
      setCurrentIdx(0);
      setMcqAnswers({});
      setEssayAnswers({});
      setTimeLeft(TIME_LIMIT_MINUTES * 60);
      setPhase("test");
    } catch (err: any) {
      setError(err.message || "Failed to generate mock test");
      setPhase("config");
    }
  };

  useEffect(() => {
    if (phase !== "test") return;
    if (timeLeft <= 0) { submitTest(); return; }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // Scroll to top on phase change or when navigating between questions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [phase, currentIdx]);

  const submitTest = useCallback(async () => {
    if (!mockTest) return;
    setPhase("submitting");
    try {
      const res = await apiClient.submitMockTest(mockTest.mock_test_id, mcqAnswers, essayAnswers);
      setResult(res);
      setPhase("result");
    } catch (err: any) {
      setError(err.message || "Failed to submit");
      setPhase("test");
    }
  }, [mockTest, mcqAnswers, essayAnswers]);

  const currentItem = flatItems[currentIdx];
  const currentSection = mockTest?.sections[currentItem?.sectionIdx ?? 0];
  const currentQuestion = currentSection?.questions[currentItem?.questionIdx ?? 0];

  const goNext = () => { if (currentIdx < flatItems.length - 1) setCurrentIdx((i) => i + 1); };
  const goPrev = () => { if (currentIdx > 0) setCurrentIdx((i) => i - 1); };
  const goTo = (idx: number) => setCurrentIdx(idx);

  const selectMCQ = (questionId: number, letter: string) => {
    setMcqAnswers((prev) => ({ ...prev, [String(questionId)]: letter }));
  };

  const updateEssay = (questionId: number, text: string) => {
    setEssayAnswers((prev) => ({ ...prev, [String(questionId)]: text }));
  };

  const answeredCount = flatItems.filter((item) => {
    if (item.type === "mcq") return mcqAnswers[String(item.id)];
    return (essayAnswers[String(item.id)] || "").trim().length > 0;
  }).length;

  const restart = () => {
    setPhase("config");
    setMockTest(null);
    setFlatItems([]);
    setResult(null);
    setError("");
  };

  return (
    <>
      <Navbar />
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}
        message="Please log in to take a mock test." />

      <ContentProtection>
        {/* Soft gradient background */}
        <div className="relative min-h-screen pt-24 pb-20"
          style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #faf5ff 40%, #f0fdfa 100%)" }}>

          {/* Decorative blobs */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden -z-0">
            <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
              style={{ background: "radial-gradient(circle, #818cf8, transparent 70%)" }} />
            <div className="absolute top-1/2 -right-48 w-[400px] h-[400px] rounded-full opacity-15"
              style={{ background: "radial-gradient(circle, #34d399, transparent 70%)" }} />
            <div className="absolute -bottom-24 left-1/3 w-[350px] h-[350px] rounded-full opacity-10"
              style={{ background: "radial-gradient(circle, #f59e0b, transparent 70%)" }} />
          </div>

          <div className="container relative z-10 mx-auto px-4 max-w-6xl">

            {/* ═══ CONFIG PHASE ═══ */}
            {phase === "config" && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>

                {/* Hero Banner */}
                <div className="relative mb-8 overflow-hidden rounded-3xl p-8 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #0ea5e9 100%)" }}>
                  {/* Decorative circles */}
                  <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 translate-x-16 -translate-y-16"
                    style={{ background: "radial-gradient(circle, white, transparent)" }} />
                  <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-10 translate-y-12"
                    style={{ background: "radial-gradient(circle, #a5f3fc, transparent)" }} />

                  <div className="relative z-10">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-bold text-white/90 backdrop-blur-sm mb-4">
                      <FileText className="h-3.5 w-3.5" /> Full Mock Examination
                    </span>
                    <h1 className="text-5xl font-black tracking-tight text-white mb-2"
                      style={{ textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}>
                      Mock Exam
                    </h1>
                    <p className="text-base text-indigo-100 font-medium">
                      75 MCQs + 2 Essays · 120 minutes · AI-evaluated with detailed feedback
                    </p>

                    {/* Stats row */}
                    <div className="mt-6 flex flex-wrap gap-4">
                      {[
                        { label: "Questions", value: "77" },
                        { label: "Duration", value: "120 min" },
                        { label: "Sections", value: "5" },
                        { label: "AI Feedback", value: "Instant" },
                      ].map(({ label, value }) => (
                        <div key={label} className="rounded-2xl bg-white/15 backdrop-blur-sm px-4 py-2.5 border border-white/20">
                          <div className="text-xl font-black text-white">{value}</div>
                          <div className="text-[11px] font-semibold text-indigo-200 uppercase tracking-wider">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Config Card */}
                <div className="rounded-3xl border border-white/80 bg-white p-6 sm:p-8 shadow-xl shadow-indigo-100/40 space-y-7">

                  {/* Category Selector */}
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 block">
                      Select Category
                    </label>
                    <div className="relative sm:max-w-md">
                      <button type="button" onClick={() => setCategoryOpen(!categoryOpen)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-5 py-3.5 text-sm font-bold transition-all duration-200 ${
                          selectedCategory
                            ? "border-indigo-400 bg-indigo-50 text-indigo-800 shadow-md shadow-indigo-100"
                            : "border-slate-200 bg-slate-50 text-slate-500 hover:border-indigo-300 hover:bg-indigo-50/50"
                        }`}>
                        <span>{selectedCategory ? `${selectedCategory.code} — ${selectedCategory.title}` : "Choose a category…"}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${categoryOpen ? "rotate-180 text-indigo-500" : "text-slate-400"}`} />
                      </button>

                      <AnimatePresence>
                        {categoryOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute z-20 mt-2 w-full max-h-80 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-indigo-100/60"
                            style={{ minHeight: 200 }}>
                            {categories.map((cat) => (
                              <button key={cat.code} type="button"
                                onClick={() => { setSelectedCategory(cat); setCategoryOpen(false); }}
                                className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-indigo-50 ${selectedCategory?.code === cat.code ? "bg-indigo-50" : ""}`}>
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white shadow-sm">
                                  {cat.code.split("-")[1]}
                                </span>
                                <div className="flex-1">
                                  <div className="text-sm font-bold text-slate-800">{cat.code} — {cat.title}</div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">{cat.description}</div>
                                </div>
                                {selectedCategory?.code === cat.code && (
                                  <CheckCircle2 className="h-4 w-4 text-indigo-500 shrink-0 mt-1" />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Test Info Strip */}
                  {selectedCategory && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 px-5 py-4"
                      style={{ background: "linear-gradient(135deg, #eef2ff, #f5f3ff)" }}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow">
                        {selectedCategory.code.split("-")[1]}
                      </span>
                      <span className="text-sm font-bold text-indigo-800">{selectedCategory.code}</span>
                      <div className="h-4 w-px bg-indigo-200" />
                      {[
                        { icon: Target, text: "75 MCQs + 2 Essays", color: "text-indigo-500" },
                        { icon: Clock, text: "120 min", color: "text-violet-500" },
                        { icon: Award, text: "AI-Evaluated", color: "text-amber-500" },
                      ].map(({ icon: Icon, text, color }) => (
                        <div key={text} className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span>{text}</span>
                          <div className="h-4 w-px bg-indigo-200 ml-2 last:hidden" />
                        </div>
                      ))}
                    </motion.div>
                  )}

                  {/* Section Breakdown */}
                  {selectedCategory && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[
                          { icon: BookOpen, label: "Verbal Reasoning", count: "20 MCQs", from: "#6366f1", to: "#818cf8", bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3" },
                          { icon: BarChart3, label: "Quantitative Reasoning", count: "25 MCQs", from: "#0ea5e9", to: "#38bdf8", bg: "#f0f9ff", border: "#bae6fd", text: "#0c4a6e" },
                          { icon: Target, label: "Subject Knowledge", count: "30 MCQs", from: "#10b981", to: "#34d399", bg: "#f0fdf4", border: "#a7f3d0", text: "#064e3b" },
                          { icon: PenLine, label: "Argumentative Essay", count: "1 Essay", from: "#f59e0b", to: "#fbbf24", bg: "#fffbeb", border: "#fde68a", text: "#78350f" },
                          { icon: MessageSquare, label: "Narrative Essay", count: "1 Essay", from: "#f43f5e", to: "#fb7185", bg: "#fff1f2", border: "#fecdd3", text: "#881337" },
                        ].map(({ icon: Icon, label, count, from, to, bg, border, text }) => (
                          <div key={label} className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all hover:shadow-md hover:-translate-y-0.5"
                            style={{ backgroundColor: bg, borderColor: border }}>
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm"
                              style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-bold" style={{ color: text }}>{label}</div>
                              <div className="text-xs font-medium text-slate-500">{count}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Detailed composition blocks */}
                      {(() => {
                        const SUBJECT_SPLITS: Record<string, Array<[string, number]>> = {
                          "USAT-E":   [["Physics", 10], ["Chemistry", 10], ["Mathematics", 10]],
                          "USAT-M":   [["Physics", 8], ["Chemistry", 8], ["Biology", 14]],
                          "USAT-CS":  [["Physics", 8], ["Computer Science", 14], ["Mathematics", 8]],
                          "USAT-A":   [["Islamiat/Ethics", 10], ["Pakistan Studies", 10], ["General Knowledge", 10]],
                          "USAT-GS":  [["Mathematics", 10], ["Statistics", 10], ["Economics", 10]],
                          "USAT-COM": [["Accounting", 10], ["Commerce", 10], ["Economics", 10]],
                        };
                        const verbal: Array<[string, number]> = [["Analogy", 6], ["Synonym/Antonym", 6], ["Sentence Completion", 8]];
                        const quant: Array<[string, number]> = [
                          ["Arithmetic", 6], ["Algebra and Functions", 4], ["Geometry", 3],
                          ["Equations", 3], ["Statistics", 3], ["Scenario Based / Mental Mathematics", 6],
                        ];
                        const subjects = SUBJECT_SPLITS[selectedCategory.code] || [];
                        const Block = ({ title, items, bg, border, accent }: { title: string; items: Array<[string, number]>; bg: string; border: string; accent: string }) => (
                          <div className="rounded-2xl border p-4" style={{ backgroundColor: bg, borderColor: border }}>
                            <div className="text-[10px] font-black uppercase tracking-[0.15em] mb-3" style={{ color: accent }}>{title}</div>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                              {items.map(([name, n]) => (
                                <li key={name} className="flex items-center justify-between gap-2">
                                  <span className="text-xs text-slate-600 truncate">{name}</span>
                                  <span className="text-xs font-black rounded-md px-1.5 py-0.5 shrink-0" style={{ backgroundColor: border, color: accent }}>{n}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                        return (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <Block title="Verbal Reasoning · 20" items={verbal} bg="#eef2ff" border="#c7d2fe" accent="#4338ca" />
                            <Block title="Quantitative Reasoning · 25" items={quant} bg="#f0f9ff" border="#bae6fd" accent="#0369a1" />
                            {subjects.length > 0 && (
                              <Block title="Subject Knowledge · 30" items={subjects} bg="#f0fdf4" border="#a7f3d0" accent="#047857" />
                            )}
                          </div>
                        );
                      })()}

                      {/* Smart fetch note */}
                      <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-sm">
                          <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-violet-800 mb-0.5">Smart Question Fetch</div>
                          <p className="text-xs text-violet-700 leading-relaxed">
                            Every test pulls a fresh set of MCQs — no duplicates within the test, and questions you've already seen in past attempts are skipped until the question pool is exhausted.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
                      <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" /> {error}
                    </div>
                  )}

                  {/* Pro lock */}
                  {!isPro && (
                    <div className="flex items-center gap-4 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm">
                        <Lock className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-amber-900">Pro Feature Required</p>
                        <p className="text-xs text-amber-700 mt-0.5">Mock tests are available for Pro users only. Upgrade to unlock full mock tests with AI-evaluated essays!</p>
                      </div>
                    </div>
                  )}

                  {/* CTA Button */}
                  <button onClick={startTest} disabled={!selectedCategory || !isPro}
                    className="group w-full flex items-center justify-center gap-3 rounded-2xl py-4 text-base font-black text-white shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{ background: !selectedCategory || !isPro ? undefined : "linear-gradient(135deg, #4f46e5, #7c3aed, #0ea5e9)" }}>
                    {!isPro
                      ? <><Lock className="h-5 w-5" /> Upgrade to Pro</>
                      : <><Play className="h-5 w-5 transition-transform group-hover:scale-110" /> Start Mock Test</>
                    }
                  </button>
                </div>
              </motion.div>
            )}

            {/* ═══ LOADING PHASE ═══ */}
            {phase === "loading" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40">
                <div className="relative mb-6">
                  <div className="h-20 w-20 rounded-full opacity-20 animate-ping absolute inset-0"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }} />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-xl"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                    <Loader2 className="h-9 w-9 animate-spin text-white" />
                  </div>
                </div>
                <p className="text-xl font-black text-slate-800">Generating your mock test…</p>
                <p className="text-sm text-slate-500 mt-2">Fetching fresh questions from the database</p>
                <div className="mt-6 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-2 w-2 rounded-full animate-bounce"
                      style={{ background: "#4f46e5", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ TEST PHASE ═══ */}
            {phase === "test" && mockTest && currentItem && currentQuestion && (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

                {/* Top Bar */}
                <div className="mb-5 rounded-2xl border border-white/80 bg-white p-4 shadow-lg shadow-indigo-100/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-slate-700">
                        Q {currentIdx + 1} <span className="font-normal text-slate-400">/ {flatItems.length}</span>
                      </span>
                      <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {answeredCount} answered
                      </span>
                    </div>

                    <span className="text-xs font-bold px-4 py-1.5 rounded-full border"
                      style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#4338ca" }}>
                      {currentSection?.label}
                    </span>

                    <span className={`font-mono text-sm font-black flex items-center gap-1.5 rounded-xl px-4 py-2 border-2 transition-all ${
                      timeLeft < 300
                        ? "text-rose-700 bg-rose-50 border-rose-200 shadow-rose-100 shadow-sm"
                        : "text-emerald-700 bg-emerald-50 border-emerald-200 shadow-emerald-100 shadow-sm"
                    }`}>
                      <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <motion.div className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #4f46e5, #7c3aed, #0ea5e9)" }}
                      initial={false}
                      animate={{ width: `${Math.round(((currentIdx + 1) / flatItems.length) * 100)}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }} />
                  </div>
                </div>

                <div className="flex gap-5">
                  {/* ── Question Area ── */}
                  <div className="flex-1 min-w-0">
                    <div key={currentIdx}>

                        {/* MCQ */}
                        {currentItem.type === "mcq" && isMCQ(currentQuestion) && (
                          <div className="rounded-3xl border border-white/80 bg-white p-6 sm:p-8 shadow-xl shadow-indigo-100/20">
                            <div className="mb-4 flex items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                                style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#4338ca" }}>
                                {(currentQuestion as MockTestMCQQuestion).subject}
                              </span>
                              <span className="text-[11px] font-semibold text-slate-400">Multiple Choice</span>
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-7 leading-relaxed">
                              <span className="text-indigo-500 font-black mr-2">{currentIdx + 1}.</span>
                              {currentQuestion.question}
                            </h2>

                            <div className="space-y-3">
                              {currentQuestion.options.map((opt, i) => {
                                const letter = LETTER[i];
                                const isSelected = mcqAnswers[String(currentQuestion.id)] === letter;
                                const colors = OPTION_COLORS[i];
                                return (
                                  <button key={i}
                                    onClick={() => selectMCQ(currentQuestion.id, letter)}
                                    className={`w-full flex items-start gap-4 px-5 py-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                                      isSelected
                                        ? colors.active + " shadow-lg -translate-y-0.5"
                                        : colors.idle + " hover:-translate-y-0.5 hover:shadow-md"
                                    }`}>
                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-all ${
                                      isSelected ? "bg-white/25 text-white" : "bg-white text-slate-600 shadow-sm"
                                    }`}>{letter}</span>
                                    <span className="text-sm font-medium leading-relaxed pt-0.5">{opt}</span>
                                    {isSelected && (
                                      <CheckCircle2 className="h-5 w-5 ml-auto shrink-0 mt-0.5 text-white/80" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Essay */}
                        {currentItem.type === "essay" && !isMCQ(currentQuestion) && (
                          <div className="rounded-3xl border border-white/80 bg-white p-6 sm:p-8 shadow-xl shadow-amber-100/20">
                            <div className="mb-4 flex items-center gap-2">
                              <span className="text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full border capitalize"
                                style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
                                {(currentQuestion as MockTestEssayQuestion).essay_type} Essay
                              </span>
                            </div>
                            <h2 className="text-lg font-bold text-slate-800 mb-5 leading-relaxed">
                              {(currentQuestion as MockTestEssayQuestion).prompt_text}
                            </h2>
                            <textarea
                              value={essayAnswers[String(currentQuestion.id)] || ""}
                              onChange={(e) => updateEssay(currentQuestion.id, e.target.value)}
                              placeholder="Write your essay here…"
                              rows={14}
                              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-5 py-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition resize-y leading-relaxed"
                            />
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="text-xs text-slate-400">Aim for 300–500 words</span>
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                {(essayAnswers[String(currentQuestion.id)] || "").split(/\s+/).filter(Boolean).length} words
                              </span>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-5 gap-3">
                      <button onClick={goPrev} disabled={currentIdx === 0}
                        className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white/90 px-5 py-2.5 text-sm font-bold text-slate-600 transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                        <ArrowLeft className="h-4 w-4" /> Previous
                      </button>

                      {currentIdx === flatItems.length - 1 ? (
                        <button onClick={submitTest}
                          className="flex items-center gap-2.5 rounded-2xl px-7 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                          style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }}>
                          <Send className="h-4 w-4" /> Submit Test
                        </button>
                      ) : (
                        <button onClick={goNext}
                          className="flex items-center gap-2.5 rounded-2xl px-7 py-2.5 text-sm font-black text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                          style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                          Next <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── Sidebar Navigator ── */}
                  <div className="hidden lg:block w-64 shrink-0">
                    <div className="sticky top-28 rounded-3xl border border-white/80 bg-white p-5 shadow-lg max-h-[calc(100vh-8rem)] overflow-y-auto">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-4">Question Navigator</h3>
                      {mockTest.sections.map((sec, si) => (
                        <div key={si} className="mb-4">
                          <div className="text-[10px] font-black uppercase tracking-wider mb-2 px-1"
                            style={{ color: "#4338ca" }}>{sec.label}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {sec.questions.map((q, qi) => {
                              const flatIdx = flatItems.findIndex(
                                (fi) => fi.sectionIdx === si && fi.questionIdx === qi
                              );
                              const isActive = flatIdx === currentIdx;
                              const isAnswered =
                                sec.type === "mcq"
                                  ? !!mcqAnswers[String(q.id)]
                                  : (essayAnswers[String(q.id)] || "").trim().length > 0;
                              return (
                                <button key={q.id} onClick={() => goTo(flatIdx)}
                                  className={`h-8 w-8 rounded-xl text-[11px] font-bold transition-all duration-150 ${
                                    isActive
                                      ? "text-white shadow-md shadow-indigo-200 -translate-y-0.5"
                                      : isAnswered
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:-translate-y-0.5"
                                  }`}
                                  style={isActive ? { background: "linear-gradient(135deg, #4f46e5, #7c3aed)" } : {}}>
                                  {flatIdx + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="mt-4 pt-4 border-t border-slate-100">
                        {/* Legend */}
                        <div className="flex gap-3 mb-3">
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                            <div className="h-3 w-3 rounded-md bg-emerald-200 border border-emerald-400" /> Answered
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                            <div className="h-3 w-3 rounded-md bg-slate-200" /> Skipped
                          </div>
                        </div>
                        <div className="text-xs text-slate-500 mb-3">
                          <span className="font-black text-indigo-600">{answeredCount}</span> / {flatItems.length} answered
                        </div>
                        <button onClick={submitTest}
                          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black text-white shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
                          style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }}>
                          <Send className="h-3.5 w-3.5" /> Submit Test
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ═══ SUBMITTING PHASE ═══ */}
            {phase === "submitting" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-40">
                <div className="relative mb-6">
                  <div className="h-20 w-20 rounded-full opacity-20 animate-ping absolute inset-0"
                    style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }} />
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full shadow-xl"
                    style={{ background: "linear-gradient(135deg, #059669, #0d9488)" }}>
                    <Loader2 className="h-9 w-9 animate-spin text-white" />
                  </div>
                </div>
                <p className="text-xl font-black text-slate-800">Evaluating your answers…</p>
                <p className="text-sm text-slate-500 mt-2">MCQs graded instantly · Essays evaluated by AI</p>
                <div className="mt-6 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-2 w-2 rounded-full animate-bounce"
                      style={{ background: "#059669", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══ RESULT PHASE ═══ */}
            {phase === "result" && result && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

                {/* Score Hero */}
                <div className="relative mb-8 overflow-hidden rounded-3xl p-8 shadow-2xl"
                  style={{
                    background: result.percentage >= 70
                      ? "linear-gradient(135deg, #059669, #0d9488, #0284c7)"
                      : result.percentage >= 50
                      ? "linear-gradient(135deg, #d97706, #f59e0b, #ef4444)"
                      : "linear-gradient(135deg, #dc2626, #e11d48, #7c3aed)",
                  }}>
                  <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 translate-x-20 -translate-y-20"
                    style={{ background: "radial-gradient(circle, white, transparent)" }} />
                  <div className="absolute bottom-0 left-1/4 w-48 h-48 rounded-full opacity-10 translate-y-16"
                    style={{ background: "radial-gradient(circle, white, transparent)" }} />

                  <div className="relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 text-sm font-bold text-white/90 mb-5 border border-white/20">
                      <Award className="h-4 w-4" /> {result.category} Mock Test Result
                    </div>
                    <div className="text-8xl font-black text-white mb-1"
                      style={{ textShadow: "0 4px 30px rgba(0,0,0,0.25)" }}>
                      {result.percentage}%
                    </div>
                    <p className="text-lg font-semibold text-white/80 mb-6">
                      {result.total_score} / {result.max_score} total points
                    </p>
                    <div className="flex justify-center gap-8">
                      {[
                        { value: `${result.mcq_score}/${result.mcq_total}`, label: "MCQs Correct" },
                        { value: `${result.essay_score}/${result.essay_total}`, label: "Essay Score" },
                      ].map(({ value, label }) => (
                        <div key={label} className="text-center">
                          <div className="text-3xl font-black text-white">{value}</div>
                          <div className="text-xs font-semibold text-white/70 mt-1 uppercase tracking-wider">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Summary */}
                {result.ai_summary && (
                  <div className="mb-6 rounded-3xl border border-violet-200/60 p-6 sm:p-8 shadow-xl"
                    style={{ background: "linear-gradient(135deg, #faf5ff, #ffffff, #eff6ff)" }}>
                    <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl shadow-sm"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}>
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      AI Performance Analysis
                    </h3>

                    {/* Verdict */}
                    <div className="flex flex-wrap items-start gap-3 mb-6 p-4 rounded-2xl border border-violet-100 bg-violet-50/50">
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black border ${
                        result.ai_summary.performance_level === "Excellent" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                        result.ai_summary.performance_level === "Good" ? "bg-indigo-100 text-indigo-700 border-indigo-300" :
                        result.ai_summary.performance_level === "Average" ? "bg-amber-100 text-amber-700 border-amber-300" :
                        result.ai_summary.performance_level === "Needs Improvement" ? "bg-orange-100 text-orange-700 border-orange-300" :
                        "bg-rose-100 text-rose-700 border-rose-300"
                      }`}>
                        <Star className="h-3 w-3" /> {result.ai_summary.performance_level}
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed flex-1">{result.ai_summary.overall_verdict}</p>
                    </div>

                    {/* Strong & Weak */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                      {result.ai_summary.strong_areas?.length > 0 && (
                        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-5">
                          <h4 className="text-sm font-black text-emerald-700 mb-3 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Strong Areas
                          </h4>
                          <div className="space-y-2.5">
                            {result.ai_summary.strong_areas.map((s: any, i: number) => (
                              <div key={i} className="flex gap-2.5 items-start">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-xs font-bold text-emerald-900">{s.area}</span>
                                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{s.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {result.ai_summary.weak_areas?.length > 0 && (
                        <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/70 p-5">
                          <h4 className="text-sm font-black text-rose-700 mb-3 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Areas to Improve
                          </h4>
                          <div className="space-y-2.5">
                            {result.ai_summary.weak_areas.map((w: any, i: number) => (
                              <div key={i} className="flex gap-2.5 items-start">
                                <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                                <div>
                                  <span className="text-xs font-bold text-rose-900">{w.area}</span>
                                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{w.detail}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Study plan */}
                    {result.ai_summary.study_plan?.length > 0 && (
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 mb-4">
                        <h4 className="text-sm font-black text-indigo-700 mb-3 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4" /> Recommended Study Plan
                        </h4>
                        <div className="space-y-2.5">
                          {result.ai_summary.study_plan.map((tip: string, i: number) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white mt-0.5"
                                style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                                {i + 1}
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">{tip}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Motivational note */}
                    {result.ai_summary.motivational_note && (
                      <div className="rounded-2xl border border-violet-200 px-5 py-4 text-center"
                        style={{ background: "linear-gradient(135deg, #f5f3ff, #eff6ff)" }}>
                        <p className="text-sm text-violet-800 font-semibold italic">
                          "{result.ai_summary.motivational_note}"
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Results */}
                <div className="mb-6 rounded-3xl border border-white/80 bg-white p-6 sm:p-8 shadow-xl shadow-indigo-100/20">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                        <Target className="h-4 w-4 text-white" />
                      </div>
                      MCQ Results
                    </h3>
                    <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                      {result.mcq_score} / {result.mcq_total} correct
                    </span>
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                    {result.mcq_results.map((mcq, i) => (
                      <div key={mcq.question_id}
                        className={`rounded-2xl border-2 p-5 transition-all ${
                          mcq.is_correct
                            ? "border-emerald-200 bg-emerald-50/50"
                            : mcq.selected
                            ? "border-rose-200 bg-rose-50/50"
                            : "border-slate-200 bg-slate-50/50"
                        }`}>
                        <div className="flex items-start gap-3">
                          {mcq.is_correct
                            ? <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm mt-0.5"><CheckCircle2 className="h-4 w-4 text-white" /></div>
                            : <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-500 shadow-sm mt-0.5"><XCircle className="h-4 w-4 text-white" /></div>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 mb-3">{i + 1}. {mcq.question}</p>

                            {mcq.options && mcq.options.length > 0 ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                {mcq.options.map((opt, oi) => {
                                  const letter = LETTER[oi];
                                  const isRight = letter === mcq.correct;
                                  const isUser = letter === mcq.selected;
                                  return (
                                    <div key={oi} className={`rounded-xl px-3 py-2 text-xs font-semibold border flex items-center gap-1.5 ${
                                      isRight ? "bg-emerald-100 border-emerald-300 text-emerald-800" :
                                      isUser && !isRight ? "bg-rose-100 border-rose-300 text-rose-800" :
                                      "bg-white border-slate-200 text-slate-500"
                                    }`}>
                                      <span className="font-black">{letter}.</span>
                                      <span className="flex-1">{opt}</span>
                                      {isRight && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                      {isUser && !isRight && <XCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="mt-2 flex flex-wrap gap-2 text-xs mb-3">
                                {mcq.selected && (
                                  <span className={`px-2.5 py-1 rounded-lg font-bold ${mcq.is_correct ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                    Your answer: {mcq.selected}
                                  </span>
                                )}
                                {!mcq.is_correct && (
                                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                                    Correct: {mcq.correct}
                                  </span>
                                )}
                                {!mcq.selected && (
                                  <span className="px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600 font-bold">Unanswered</span>
                                )}
                              </div>
                            )}

                            {mcq.explanation && (
                              <p className="text-xs text-slate-500 leading-relaxed bg-white/80 rounded-xl px-3 py-2 border border-slate-100">
                                <span className="font-bold text-indigo-600">Explanation: </span>{mcq.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Essay Results */}
                {result.essay_results.length > 0 && (
                  <div className="mb-6 rounded-3xl border border-white/80 bg-white p-6 sm:p-8 shadow-xl shadow-amber-100/20">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl"
                          style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                          <PenLine className="h-4 w-4 text-white" />
                        </div>
                        Essay Results
                      </h3>
                      <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                        {result.essay_score} / {result.essay_total} pts
                      </span>
                    </div>

                    <div className="space-y-5">
                      {result.essay_results.map((essay) => (
                        <div key={essay.question_id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border capitalize"
                              style={{ background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}>
                              {essay.essay_type}
                            </span>
                            <span className={`text-xl font-black ${
                              essay.score >= essay.max_score * 0.7 ? "text-emerald-600" :
                              essay.score >= essay.max_score * 0.5 ? "text-amber-600" : "text-rose-600"
                            }`}>{essay.score}/{essay.max_score}</span>
                          </div>
                          <p className="text-sm font-semibold text-slate-700 mb-4">{essay.prompt}</p>

                          <div className="rounded-2xl bg-white border border-amber-200 p-5">
                            <div className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">AI Feedback</div>
                            {typeof essay.feedback === "object" && essay.feedback !== null ? (() => {
                              const fb = essay.feedback as any;
                              return (
                              <div className="space-y-3">
                                {fb.band && (
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-amber-200 bg-amber-100 text-amber-800">
                                      {fb.band}
                                    </span>
                                    {fb.headline && <span className="text-sm font-bold text-slate-800 italic">“{fb.headline}”</span>}
                                  </div>
                                )}
                                <p className="text-sm text-slate-700 leading-relaxed">{fb.overall_feedback}</p>
                                {fb.mistakes?.length > 0 && (
                                  <div className="mt-3 space-y-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
                                    <div className="text-xs font-bold text-rose-700 mb-1.5">Key Mistakes</div>
                                    {fb.mistakes.slice(0, 3).map((m: any, mi: number) => (
                                      <div key={mi} className="text-xs text-slate-600 flex gap-2 items-start">
                                        <span className="text-rose-400 mt-px shrink-0">•</span>
                                        <span><span className="font-semibold capitalize">{m.type}:</span> {m.issue}{m.fix ? ` → ${m.fix}` : ""}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {fb.improvement_tips?.length > 0 && (
                                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                                    <div className="text-xs font-bold text-indigo-700 mb-1.5">Improvement Tips</div>
                                    {fb.improvement_tips.slice(0, 2).map((tip: string, ti: number) => (
                                      <div key={ti} className="text-xs text-slate-600 flex gap-2 items-start">
                                        <span className="text-indigo-400 mt-px shrink-0">•</span>
                                        <span>{tip}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {fb.model_rewrite && (
                                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <div className="text-xs font-bold text-emerald-700 mb-1.5">Model Rewrite</div>
                                    <p className="text-xs text-slate-700 italic leading-relaxed">“{fb.model_rewrite}”</p>
                                  </div>
                                )}
                                {fb.next_step_focus && (
                                  <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
                                    <div className="text-xs font-bold text-violet-700 mb-1">Focus Next Time</div>
                                    <p className="text-xs text-slate-700">{fb.next_step_focus}</p>
                                  </div>
                                )}
                              </div>
                              );
                            })() : (
                              <p className="text-sm text-slate-700 leading-relaxed">{typeof essay.feedback === "string" ? essay.feedback : "Evaluation complete."}</p>
                            )}
                          </div>

                          {essay.user_answer && (
                            <details className="mt-4">
                              <summary className="text-xs font-bold text-slate-500 cursor-pointer hover:text-indigo-600 transition-colors">View your response ↓</summary>
                              <p className="mt-3 text-sm text-slate-600 whitespace-pre-wrap bg-white rounded-xl p-4 border border-slate-100 leading-relaxed">{essay.user_answer}</p>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 justify-center pb-4">
                  <button onClick={restart}
                    className="flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                    <RotateCcw className="h-4 w-4" /> Take Another Test
                  </button>
                  <button onClick={() => navigate("/practice")}
                    className="flex items-center gap-2.5 rounded-2xl border-2 border-slate-200 bg-white/90 px-8 py-3.5 text-sm font-bold text-slate-700 shadow-md transition-all hover:border-indigo-300 hover:bg-indigo-50 hover:-translate-y-0.5 hover:shadow-lg">
                    <ArrowLeft className="h-4 w-4" /> Back to Practice
                  </button>
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </ContentProtection>
    </>
  );
};

export default MockTestPage;
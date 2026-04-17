import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ArrowRight, ArrowLeft, Play, Target, BookOpen, AlertCircle,
  Loader2, ChevronDown, CheckCircle2, XCircle, FileText, Send,
  RotateCcw, Award, BarChart3, MessageSquare, PenLine,
} from "lucide-react";
import Navbar from "@/components/Navbar";
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
  { idle: "bg-blue-100 text-blue-800 border-blue-300", active: "bg-blue-600 text-white border-blue-600" },
  { idle: "bg-sky-100 text-sky-800 border-sky-300", active: "bg-sky-600 text-white border-sky-600" },
  { idle: "bg-emerald-100 text-emerald-800 border-emerald-300", active: "bg-emerald-600 text-white border-emerald-600" },
  { idle: "bg-amber-100 text-amber-800 border-amber-300", active: "bg-amber-500 text-white border-amber-500" },
];

type Phase = "config" | "loading" | "test" | "submitting" | "result";

/* ── Flat question item for navigation ── */
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

  /* Config */
  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<USATCategory | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  /* Test state */
  const [mockTest, setMockTest] = useState<MockTestGenerated | null>(null);
  const [flatItems, setFlatItems] = useState<FlatItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState("");

  /* Result */
  const [result, setResult] = useState<MockTestResult | null>(null);

  const fetchedRef = useRef(false);
  const TIME_LIMIT_MINUTES = 120; // 120 minutes for full mock test

  /* ── Preload categories ── */
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient.listUSATCategories().then(setCategories).catch(() => {});
    // Auto-select from URL params
    const cat = searchParams.get("category");
    if (cat) {
      apiClient.listUSATCategories().then((cats) => {
        const found = cats.find((c) => c.code === cat.toUpperCase());
        if (found) setSelectedCategory(found);
      });
    }
  }, [searchParams]);

  /* ── Flatten sections for linear navigation ── */
  const buildFlatItems = (sections: MockTestSection[]): FlatItem[] => {
    const items: FlatItem[] = [];
    sections.forEach((sec, si) => {
      sec.questions.forEach((q, qi) => {
        items.push({
          sectionIdx: si,
          questionIdx: qi,
          type: sec.type as "mcq" | "essay",
          id: q.id,
        });
      });
    });
    return items;
  };

  /* ── Generate test ── */
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

  /* ── Timer ── */
  useEffect(() => {
    if (phase !== "test") return;
    if (timeLeft <= 0) { submitTest(); return; }
    const t = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  /* ── Submit ── */
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

  /* ── Navigation helpers ── */
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

      <div className="relative min-h-screen bg-slate-50 pt-24 pb-20 dark:bg-background">

        <div className="container relative z-10 mx-auto px-4 max-w-6xl">

          {/* ═══ CONFIG PHASE ═══ */}
          {phase === "config" && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Hero */}
              <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-600 p-8 shadow-xl shadow-blue-400/20">
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-sm">
                    <FileText className="h-3.5 w-3.5" /> Full Mock Test
                  </span>
                  <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                    Mock Exam
                  </h1>
                  <p className="mt-1.5 text-sm text-blue-200">
                    75 MCQs + 2 Essays — 120 min, AI-evaluated, with detailed feedback.
                  </p>
                </div>
              </div>

              {/* Config card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-blue-100/30 space-y-6">
                {/* Category selector */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Category</label>
                  <div className="relative sm:max-w-sm">
                    <button type="button" onClick={() => setCategoryOpen(!categoryOpen)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all duration-200 ${
                        selectedCategory ? "border-blue-400 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                      <span>{selectedCategory ? `${selectedCategory.code} — ${selectedCategory.title}` : "Select a category…"}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${categoryOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {categoryOpen && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="absolute z-20 mt-1.5 w-full max-h-80 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-blue-100/40"
                          style={{ minHeight: 200 }} // DEBUG: force height
>
                          {categories.map((cat) => (
                            <button key={cat.code} type="button"
                              onClick={() => { setSelectedCategory(cat); setCategoryOpen(false); }}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-blue-50 ${selectedCategory?.code === cat.code ? "bg-blue-50" : ""}`}>
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-xs font-black text-blue-700">{cat.code.split("-")[1]}</span>
                              <div>
                                <div className="text-sm font-bold text-slate-800">{cat.code} — {cat.title}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{cat.description}</div>
                              </div>
                              {selectedCategory?.code === cat.code && <CheckCircle2 className="ml-auto h-4 w-4 text-blue-500 shrink-0 mt-0.5" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Test info */}
                {selectedCategory && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-blue-300 bg-blue-50 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-200 text-[10px] font-black text-blue-800">{selectedCategory.code.split("-")[1]}</span>
                      <span className="text-sm font-bold text-blue-800">{selectedCategory.code}</span>
                    </div>
                    <div className="h-4 w-px bg-blue-300" />
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-cyan-500" />
                      <span className="font-semibold text-slate-700">75 MCQs + 2 Essays</span>
                    </div>
                    <div className="h-4 w-px bg-blue-300" />
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-cyan-500" />
                      <span className="font-semibold text-slate-700">120 min</span>
                    </div>
                    <div className="h-4 w-px bg-blue-300" />
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-slate-700">AI-Evaluated</span>
                    </div>
                  </div>
                )}

                {/* Section breakdown */}
                {selectedCategory && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { icon: BookOpen, label: "Verbal Reasoning", count: "20 MCQs", color: "blue" },
                      { icon: BarChart3, label: "Quantitative Reasoning", count: "25 MCQs", color: "sky" },
                      { icon: Target, label: "Subject Knowledge", count: "30 MCQs", color: "emerald" },
                      { icon: PenLine, label: "Argumentative Essay", count: "1 Essay", color: "amber" },
                      { icon: MessageSquare, label: "Narrative Essay", count: "1 Essay", color: "rose" },
                    ].map(({ icon: Icon, label, count, color }) => (
                      <div key={label} className={`flex items-center gap-3 rounded-xl border border-${color}-200 bg-${color}-50 px-4 py-3`}>
                        <Icon className={`h-5 w-5 text-${color}-500`} />
                        <div>
                          <div className="text-sm font-bold text-slate-700">{label}</div>
                          <div className="text-xs text-slate-500">{count}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}

                <button onClick={startTest} disabled={!selectedCategory}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 py-4 text-base font-bold text-white shadow-xl shadow-blue-300/40 transition-all duration-200 hover:from-cyan-500 hover:to-blue-500 hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                  <Play className="h-5 w-5" /> Start Mock Test
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ LOADING PHASE ═══ */}
          {phase === "loading" && (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
              <p className="text-lg font-bold text-slate-700">Generating your mock test…</p>
              <p className="text-sm text-slate-400 mt-1">Fetching questions from the database</p>
            </div>
          )}

          {/* ═══ TEST PHASE ═══ */}
          {phase === "test" && mockTest && currentItem && currentQuestion && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

              {/* Top bar */}
              <div className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-md shadow-blue-100/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Left: progress */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">
                      Q {currentIdx + 1} / {flatItems.length}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({answeredCount} answered)
                    </span>
                  </div>

                  {/* Center: section label */}
                  <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                    {currentSection?.label}
                  </span>

                  {/* Right: timer */}
                  <span className={`font-mono text-sm font-black flex items-center gap-1.5 rounded-xl px-3 py-2 border-2 ${
                    timeLeft < 300 ? "text-rose-700 bg-rose-100 border-rose-300" : "text-emerald-700 bg-emerald-100 border-emerald-300"
                  }`}>
                    <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                    style={{ width: `${Math.round(((currentIdx + 1) / flatItems.length) * 100)}%` }} />
                </div>
              </div>

              <div className="flex gap-4">
                {/* ── Question area ── */}
                <div className="flex-1 min-w-0">
                  {currentItem.type === "mcq" && isMCQ(currentQuestion) && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-500 bg-blue-100 px-2 py-0.5 rounded">{(currentQuestion as MockTestMCQQuestion).subject}</span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-800 mt-3 mb-6 leading-relaxed">
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
                              className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-xl border-2 text-left transition-all duration-200 ${
                                isSelected ? colors.active + " shadow-md" : colors.idle + " hover:shadow-sm hover:-translate-y-0.5"
                              }`}>
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
                                isSelected ? "bg-white/25 text-white" : "bg-white text-slate-600"
                              }`}>{letter}</span>
                              <span className="text-sm font-medium leading-relaxed pt-0.5">{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {currentItem.type === "essay" && !isMCQ(currentQuestion) && (
                    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded capitalize">
                          {(currentQuestion as MockTestEssayQuestion).essay_type} Essay
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-800 mt-3 mb-4 leading-relaxed">
                        {(currentQuestion as MockTestEssayQuestion).prompt_text}
                      </h2>
                      <textarea
                        value={essayAnswers[String(currentQuestion.id)] || ""}
                        onChange={(e) => updateEssay(currentQuestion.id, e.target.value)}
                        placeholder="Write your essay here…"
                        rows={14}
                        className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 transition resize-y"
                      />
                      <div className="mt-2 text-right text-xs text-slate-400">
                        {(essayAnswers[String(currentQuestion.id)] || "").split(/\s+/).filter(Boolean).length} words
                      </div>
                    </div>
                  )}

                  {/* Navigation buttons */}
                  <div className="flex items-center justify-between mt-4 gap-3">
                    <button onClick={goPrev} disabled={currentIdx === 0}
                      className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-40">
                      <ArrowLeft className="h-4 w-4" /> Previous
                    </button>

                    {currentIdx === flatItems.length - 1 ? (
                      <button onClick={submitTest}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]">
                        <Send className="h-4 w-4" /> Submit Test
                      </button>
                    ) : (
                      <button onClick={goNext}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]">
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Question navigator sidebar ── */}
                <div className="hidden lg:block w-64 shrink-0">
                  <div className="sticky top-28 rounded-2xl border border-slate-100 bg-white p-4 shadow-md max-h-[calc(100vh-8rem)] overflow-y-auto">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Questions</h3>
                    {mockTest.sections.map((sec, si) => (
                      <div key={si} className="mb-3">
                        <div className="text-[10px] font-bold text-blue-500 mb-1.5 uppercase">{sec.label}</div>
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
                                className={`h-7 w-7 rounded-lg text-[10px] font-bold transition ${
                                  isActive
                                    ? "bg-blue-600 text-white shadow-md"
                                    : isAnswered
                                      ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}>
                                {flatIdx + 1}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <div className="text-xs text-slate-500 mb-2">
                        <span className="font-bold text-emerald-600">{answeredCount}</span> / {flatItems.length} answered
                      </div>
                      <button onClick={submitTest}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2 text-xs font-bold text-white shadow transition hover:shadow-lg">
                        <Send className="h-3.5 w-3.5" /> Submit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ SUBMITTING PHASE ═══ */}
          {phase === "submitting" && (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
              <p className="text-lg font-bold text-slate-700">Evaluating your answers…</p>
              <p className="text-sm text-slate-400 mt-1">MCQs are graded instantly. Essays are being evaluated by AI.</p>
            </div>
          )}

          {/* ═══ RESULT PHASE ═══ */}
          {phase === "result" && result && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

              {/* Score hero */}
              <div className={`relative mb-8 overflow-hidden rounded-3xl p-8 shadow-xl ${
                result.percentage >= 70 ? "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-emerald-300/20"
                : result.percentage >= 50 ? "bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 shadow-amber-300/20"
                : "bg-gradient-to-br from-rose-500 via-pink-500 to-cyan-500 shadow-rose-300/20"
              }`}>
                <div className="relative z-10 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm font-bold text-white/90 mb-4">
                    <Award className="h-4 w-4" /> {result.category} Mock Test Result
                  </div>
                  <div className="text-7xl font-black text-white mb-2">{result.percentage}%</div>
                  <p className="text-lg font-semibold text-white/80">
                    {result.total_score} / {result.max_score} points
                  </p>
                  <div className="mt-6 flex justify-center gap-6 text-white/90">
                    <div className="text-center">
                      <div className="text-2xl font-black">{result.mcq_score}/{result.mcq_total}</div>
                      <div className="text-xs font-semibold opacity-80">MCQs Correct</div>
                    </div>
                    <div className="h-10 w-px bg-white/30" />
                    <div className="text-center">
                      <div className="text-2xl font-black">{result.essay_score}/{result.essay_total}</div>
                      <div className="text-xs font-semibold opacity-80">Essay Score</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* MCQ Results */}
              <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
                <h3 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" /> MCQ Results
                  <span className="text-sm font-normal text-slate-400 ml-auto">{result.mcq_score} / {result.mcq_total} correct</span>
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {result.mcq_results.map((mcq, i) => (
                    <div key={mcq.question_id}
                      className={`rounded-xl border-2 p-4 ${mcq.is_correct ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}>
                      <div className="flex items-start gap-3">
                        {mcq.is_correct
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                          : <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700">{i + 1}. {mcq.question}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            {mcq.selected && (
                              <span className={`px-2 py-0.5 rounded font-bold ${mcq.is_correct ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"}`}>
                                Your answer: {mcq.selected}
                              </span>
                            )}
                            {!mcq.is_correct && (
                              <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 font-bold">
                                Correct: {mcq.correct}
                              </span>
                            )}
                            {!mcq.selected && (
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 font-bold">Unanswered</span>
                            )}
                          </div>
                          {mcq.explanation && (
                            <p className="mt-2 text-xs text-slate-500">{mcq.explanation}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Essay Results */}
              {result.essay_results.length > 0 && (
                <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-lg">
                  <h3 className="text-lg font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                    <PenLine className="h-5 w-5 text-amber-500" /> Essay Results
                    <span className="text-sm font-normal text-slate-400 ml-auto">{result.essay_score} / {result.essay_total} pts</span>
                  </h3>
                  <div className="space-y-4">
                    {result.essay_results.map((essay) => (
                      <div key={essay.question_id} className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-amber-600 bg-amber-200 px-2 py-0.5 rounded capitalize">{essay.essay_type}</span>
                          <span className={`text-lg font-black ${
                            essay.score >= essay.max_score * 0.7 ? "text-emerald-600" : essay.score >= essay.max_score * 0.5 ? "text-amber-600" : "text-rose-600"
                          }`}>{essay.score}/{essay.max_score}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mb-3">{essay.prompt}</p>
                        <div className="rounded-lg bg-white border border-amber-200 p-4">
                          <div className="text-xs font-bold text-slate-500 mb-1">AI Feedback:</div>
                          <p className="text-sm text-slate-700 leading-relaxed">{essay.feedback}</p>
                        </div>
                        {essay.user_answer && (
                          <details className="mt-3">
                            <summary className="text-xs font-bold text-slate-500 cursor-pointer hover:text-blue-600">View your response</summary>
                            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3 border">{essay.user_answer}</p>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 justify-center">
                <button onClick={restart}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl">
                  <RotateCcw className="h-4 w-4" /> Take Another Test
                </button>
                <button onClick={() => navigate("/practice")}
                  className="flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 shadow transition hover:border-blue-300 hover:bg-blue-50">
                  <ArrowLeft className="h-4 w-4" /> Back to Practice
                </button>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </>
  );
};

export default MockTestPage;

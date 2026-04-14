import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw, Settings,
  Play, Target, BookOpen, AlertCircle, ArrowLeft, LogOut, Loader2, ChevronDown, FileText,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { apiClient, MCQ, type Subject, type USATCategory } from "@/services/api";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";

/* ── Map DB MCQ → quiz-friendly shape ── */
interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  subject: string;
  explanation: string;
}

const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

const toQuizQuestion = (mcq: MCQ, subjectName: string): QuizQuestion => ({
  id: mcq.id,
  question: mcq.question,
  options: [mcq.option_a, mcq.option_b, mcq.option_c, mcq.option_d],
  correct: letterToIndex[mcq.correct_answer] ?? 0,
  subject: subjectName,
  explanation: mcq.explanation || `The correct answer is "${mcq[`option_${mcq.correct_answer.toLowerCase()}` as keyof MCQ]}".`,
});

const mcqCountOptions = [5, 10, 15, 20, 30, 50, 75];
const timeOptions = [
  { label: "No Timer", value: 0 },
  { label: "5 min",    value: 5 },
  { label: "10 min",   value: 10 },
  { label: "15 min",   value: 15 },
  { label: "20 min",   value: 20 },
  { label: "30 min",   value: 30 },
  { label: "45 min",   value: 45 },
  { label: "60 min",   value: 60 },
  { label: "80 min",   value: 80 },
];

/* ── Option letter colors — vivid & bold so they POP ── */
const OPTION_COLORS = [
  { idle: "bg-violet-200 text-violet-800 border-violet-400",   active: "bg-violet-600 text-white border-violet-600",   ring: "border-violet-500 bg-violet-50 shadow-violet-200" },
  { idle: "bg-sky-200 text-sky-800 border-sky-400",            active: "bg-sky-600 text-white border-sky-600",          ring: "border-sky-500 bg-sky-50 shadow-sky-200" },
  { idle: "bg-emerald-200 text-emerald-800 border-emerald-400",active: "bg-emerald-600 text-white border-emerald-600",  ring: "border-emerald-500 bg-emerald-50 shadow-emerald-200" },
  { idle: "bg-amber-200 text-amber-800 border-amber-400",      active: "bg-amber-500 text-white border-amber-500",      ring: "border-amber-500 bg-amber-50 shadow-amber-200" },
];

const SUBJECT_PILLS: Record<string, { pill: string; dot: string }> = {
  English:     { pill: "bg-violet-200 text-violet-800 border-violet-300",  dot: "bg-violet-500" },
  Mathematics: { pill: "bg-cyan-200 text-cyan-800 border-cyan-300",        dot: "bg-cyan-500" },
  Physics:     { pill: "bg-amber-200 text-amber-800 border-amber-300",     dot: "bg-amber-500" },
  Chemistry:   { pill: "bg-emerald-200 text-emerald-800 border-emerald-300",dot: "bg-emerald-500" },
  Biology:     { pill: "bg-rose-200 text-rose-800 border-rose-300",        dot: "bg-rose-500" },
};

const subjectPill = (s: string) => SUBJECT_PILLS[s]?.pill ?? "bg-slate-100 text-slate-600 border-slate-200";

const Practice = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"config" | "quiz" | "result">("config");

  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<USATCategory | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [dbSubjects, setDbSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedSubjectName, setSelectedSubjectName] = useState("All Subjects");

  const [mcqCount, setMcqCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [fetchingMCQs, setFetchingMCQs] = useState(false);

  // Pre-fetched subjects per category for instant switching
  const subjectsCacheRef = useRef<Record<string, Subject[]>>({});
  const fetchedRef = useRef(false);

  // Filter out essay-related subjects (no MCQs exist for them)
  const isEssaySubject = (name: string) => /essay/i.test(name);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    // Fetch categories, then pre-fetch all subjects in parallel
    apiClient.listUSATCategories().then((cats) => {
      setCategories(cats);
      Promise.all(
        cats.map((cat) =>
          apiClient.listUSATCategorySubjects(cat.code).then((subs) => {
            subjectsCacheRef.current[cat.code] = subs;
          }).catch(() => {})
        )
      );
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedCategory) { setDbSubjects([]); return; }
    // Use cached subjects if available, otherwise fetch
    const cached = subjectsCacheRef.current[selectedCategory.code];
    if (cached) {
      setDbSubjects(cached.filter((s) => !isEssaySubject(s.name)));
      return;
    }
    setLoadingSubjects(true);
    setSelectedSubjectId(null);
    setSelectedSubjectName("All Subjects");
    apiClient.listUSATCategorySubjects(selectedCategory.code)
      .then((subs) => {
        subjectsCacheRef.current[selectedCategory.code] = subs;
        setDbSubjects(subs.filter((s) => !isEssaySubject(s.name)));
      })
      .catch(() => setDbSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [selectedCategory]);

  const startQuiz = async () => {
    if (!apiClient.isAuthenticated()) { setAuthDialogOpen(true); return; }
    if (!selectedCategory) return;
    setFetchingMCQs(true);
    try {
      let tagged: { mcq: MCQ; subjectName: string }[] = [];
      if (selectedSubjectId) {
        // Single subject — use the per-subject endpoint (already 1 request)
        const subjectName = dbSubjects.find((s) => s.id === selectedSubjectId)?.name ?? "Unknown";
        const mcqs = await apiClient.listSubjectPracticeMCQs(selectedSubjectId, mcqCount);
        tagged = mcqs.map((mcq) => ({ mcq, subjectName }));
      } else {
        // All subjects — single bulk request for the whole category
        const subjectIds = dbSubjects.map((s) => s.id);
        const mcqs = await apiClient.listCategoryPracticeMCQs(selectedCategory.code, mcqCount, subjectIds);
        tagged = mcqs.map((mcq) => ({ mcq, subjectName: mcq.subject_name || "Unknown" }));
      }
      // Shuffle
      for (let i = tagged.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tagged[i], tagged[j]] = [tagged[j], tagged[i]];
      }
      const quizQuestions = tagged.slice(0, mcqCount).map(({ mcq, subjectName }) => toQuizQuestion(mcq, subjectName));
      if (quizQuestions.length === 0) { alert("No MCQs found for the selected subject."); return; }
      setQuestions(quizQuestions);
      setAnswers(new Array(quizQuestions.length).fill(null));
      setCurrentQ(0); setScore(0); setTimeUp(false);
      setTimeLeft(timeLimit * 60);
      setPhase("quiz");
    } catch (err: any) {
      alert(err.message || "Failed to load MCQs");
    } finally { setFetchingMCQs(false); }
  };

  const finishQuiz = useCallback(() => {
    let s = 0;
    answers.forEach((a, i) => { if (a === questions[i]?.correct) s++; });
    setScore(s); setPhase("result");
  }, [answers, questions]);

  useEffect(() => {
    if (phase !== "quiz" || timeLimit === 0) return;
    if (timeLeft <= 0) { setTimeUp(true); finishQuiz(); return; }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, timeLimit, finishQuiz]);

  useEffect(() => {
    if (phase === "quiz") window.scrollTo({ top: 0, behavior: "auto" });
  }, [phase]);

  const handleSelect = (i: number) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = i;
    setAnswers(newAnswers);
  };

  const jumpToQuestion = (index: number) => setCurrentQ(index);
  const nextQ = () => { if (currentQ < questions.length - 1) setCurrentQ(c => c + 1); };
  const prevQ = () => { if (currentQ > 0) setCurrentQ(c => c - 1); };
  const restart = () => setPhase("config");
  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const q = questions[currentQ];
  const selected = answers[currentQ] ?? null;
  const answeredCount = answers.filter(a => a !== null).length;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const progressPct = questions.length > 0 ? Math.round(((currentQ + 1) / questions.length) * 100) : 0;

  return (
    <>
      <Navbar />
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}
        message="Please log in first to start a practice test." />

      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">
        {/* blobs (CSS-only for performance) */}
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl blob-float-1" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl blob-float-2" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/15 blur-3xl blob-float-3" />

        <div className="container relative z-10 mx-auto px-4 max-w-6xl">

          {/* ══════════ CONFIG ══════════ */}
          {phase === "config" && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>

              {/* hero */}
              <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-400/30">
                <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl blob-glow-1" />
                <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl blob-glow-2" />
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                    <Settings className="h-3.5 w-3.5" /> Practice Test
                  </span>
                  <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">Configure Your Test</h1>
                  <p className="mt-1.5 text-sm text-violet-200">Pick your category, subject, questions and time — then hit start.</p>
                  <div className="mt-5 flex gap-1.5">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />)}
                  </div>
                </div>
              </div>

              {/* config card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/30 space-y-8">

                {/* Category */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Category</label>
                  <div className="relative sm:max-w-sm">
                    <button type="button" onClick={() => setCategoryOpen(!categoryOpen)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all duration-200 ${
                        selectedCategory ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                      <span>{selectedCategory ? `${selectedCategory.code} — ${selectedCategory.title}` : "Select a category…"}</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${categoryOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                      {categoryOpen && (
                        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                          className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-violet-100/40">
                          {categories.map((cat) => (
                            <button key={cat.code} type="button"
                              onClick={() => { setSelectedCategory(cat); setCategoryOpen(false); }}
                              className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-violet-50 ${selectedCategory?.code === cat.code ? "bg-violet-50" : ""}`}>
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-xs font-black text-violet-700">{cat.code.split("-")[1]}</span>
                              <div>
                                <div className="text-sm font-bold text-slate-800">{cat.code} — {cat.title}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">{cat.description}</div>
                              </div>
                              {selectedCategory?.code === cat.code && <CheckCircle2 className="ml-auto h-4 w-4 text-violet-500 shrink-0 mt-0.5" />}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Subject pills */}
                {selectedCategory && (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Subject</label>
                    {loadingSubjects ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading subjects…</div>
                    ) : dbSubjects.length === 0 ? (
                      <p className="text-sm text-slate-400">No subjects found for this category.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {["All Subjects", ...dbSubjects.map((s) => s.name)].map((s) => {
                          const isAll = s === "All Subjects";
                          const isActive = isAll ? selectedSubjectId === null : dbSubjects.find((ds) => ds.name === s)?.id === selectedSubjectId;
                          return (
                            <button key={s} onClick={() => {
                              if (isAll) { setSelectedSubjectId(null); setSelectedSubjectName("All Subjects"); }
                              else { const found = dbSubjects.find((ds) => ds.name === s); setSelectedSubjectId(found?.id ?? null); setSelectedSubjectName(s); }
                            }}
                              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                                isActive
                                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                              }`}>
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* MCQ Count */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Number of Questions</label>
                  <div className="flex flex-wrap gap-2">
                    {mcqCountOptions.map(n => (
                      <button key={n} onClick={() => setMcqCount(n)}
                        className={`w-14 py-3 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                          mcqCount === n
                            ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Time Limit</label>
                  <div className="flex flex-wrap gap-2">
                    {timeOptions.map(t => (
                      <button key={t.value} onClick={() => setTimeLimit(t.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                          timeLimit === t.value
                            ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary strip */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-violet-300 bg-violet-100 px-5 py-4">
                  {selectedCategory && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-200 text-[10px] font-black text-violet-800">{selectedCategory.code.split("-")[1]}</span>
                        <span className="text-sm font-bold text-violet-800">{selectedCategory.code}</span>
                      </div>
                      <div className="h-4 w-px bg-violet-300" />
                    </>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-violet-500" />
                    <span className="font-semibold text-slate-700">{selectedSubjectName}</span>
                  </div>
                  <div className="h-4 w-px bg-violet-300" />
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-fuchsia-500" />
                    <span className="font-semibold text-slate-700">{mcqCount} MCQs</span>
                  </div>
                  <div className="h-4 w-px bg-violet-300" />
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-slate-700">{timeLimit === 0 ? "Untimed" : `${timeLimit} min`}</span>
                  </div>
                </div>

                <button onClick={startQuiz} disabled={fetchingMCQs || !selectedCategory}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-xl shadow-violet-300/40 transition-all duration-200 hover:from-violet-500 hover:to-fuchsia-500 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-violet-400/50 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-xl">
                  {fetchingMCQs ? <><Loader2 className="h-5 w-5 animate-spin" /> Loading MCQs…</> : <><Play className="h-5 w-5" /> Start Test</>}
                </button>
              </div>

              {/* ── Mock Test Card ── */}
              <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/30">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 shadow-lg shadow-fuchsia-200/40">
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-extrabold text-slate-800">Full Mock Test</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        75 MCQs + 2 Essays — timed, AI-evaluated, with detailed feedback and results.
                      </p>
                      <button onClick={() => navigate(`/mock-test${selectedCategory ? `?category=${selectedCategory.code}` : ""}`)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-300/30 transition-all duration-200 hover:from-fuchsia-500 hover:to-violet-500 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]">
                        <Play className="h-4 w-4" /> Take Interactive Test
                      </button>
                    </div>
                  </div>
                </div>
            </motion.div>
          )}

          {/* ══════════ QUIZ ══════════ */}
          {phase === "quiz" && q && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

              {/* ── TOP PROGRESS BAR (full-width sticky feel) ── */}
              <div className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-md shadow-violet-100/20">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <button onClick={restart}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700">
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <button onClick={restart}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100">
                      <LogOut className="h-3.5 w-3.5" /> Quit
                    </button>
                  </div>

                  {/* center: Q counter */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Q {currentQ + 1}</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-xs text-slate-400">{questions.length}</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border-2 font-bold ml-1 ${subjectPill(q.subject)}`}>{q.subject}</span>
                  </div>

                  {/* timer */}
                  {timeLimit > 0 ? (
                    <span className={`font-mono text-base font-black flex items-center gap-1.5 rounded-xl px-4 py-2 border-2 ${
                      timeLeft < 60 ? "text-rose-700 bg-rose-100 border-rose-300" : "text-emerald-700 bg-emerald-100 border-emerald-300"
                    }`}>
                      <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-slate-400 rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-2 font-bold">
                      <Clock className="h-3.5 w-3.5" /> Untimed
                    </div>
                  )}
                </div>

                {/* progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }} />
                  </div>
                  <span className="text-xs font-black text-violet-600 min-w-[36px] text-right">{progressPct}%</span>
                </div>

                {/* answered mini bar */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-0.5 flex-1">
                    {questions.map((_, idx) => (
                      <div key={idx} className={`h-1.5 flex-1 rounded-full transition-all ${
                        idx === currentQ ? "bg-violet-500" :
                        answers[idx] !== null ? "bg-emerald-400" :
                        "bg-slate-200"
                      }`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold shrink-0">{answeredCount}/{questions.length} done</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">

                {/* ── QUESTION CARD ── */}
                <div>
                  <AnimatePresence mode="wait">
                    <motion.div key={currentQ}
                      initial={{ opacity: 0, x: 30, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -30, scale: 0.98 }}
                      transition={{ duration: 0.22 }}
                      className="rounded-3xl border-2 border-violet-200 bg-white p-6 sm:p-8 shadow-xl shadow-violet-200/40">

                      {/* question number badge */}
                      <div className="flex items-center gap-3 mb-5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow-md shadow-violet-300/40">
                          {String(currentQ + 1).padStart(2, "0")}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Question {currentQ + 1} of {questions.length}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-bold ${subjectPill(q.subject)}`}>
                              {q.subject}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed mb-8 border-l-4 border-violet-400 pl-4">{q.question}</p>

                      {/* Option grid — 2 columns on large screens */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, i) => {
                          const isSelected = selected === i;
                          const C = OPTION_COLORS[i];
                          return (
                            <motion.button key={i}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleSelect(i)}
                              className={`card-hover relative text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-3 group ${
                                isSelected ? `${C.ring} shadow-lg` : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                              }`}>
                              {/* letter badge */}
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black border-2 transition-all duration-200 ${
                                isSelected ? C.active : `${C.idle} group-hover:scale-110`
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className={`text-sm font-semibold leading-snug flex-1 ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                                {opt}
                              </span>
                              {isSelected && (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                  className="shrink-0 mt-0.5">
                                  <CheckCircle2 className="h-5 w-5 text-violet-500" />
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* prev / next inline below options */}
                      <div className="mt-6 flex items-center gap-3">
                        <button onClick={prevQ} disabled={currentQ === 0}
                          className="flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                          <ArrowLeft className="h-4 w-4" /> Prev
                        </button>
                        <div className="flex-1" />
                        {currentQ < questions.length - 1 ? (
                          <button onClick={nextQ}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:from-violet-500 hover:to-fuchsia-500">
                            Next <ArrowRight className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={finishQuiz}
                            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-400 hover:to-teal-400">
                            Submit <CheckCircle2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ── SIDEBAR ── */}
                <aside className="lg:sticky lg:top-28 space-y-4">

                  {/* Navigator */}
                  <div className="rounded-2xl border-2 border-violet-200 bg-white p-4 shadow-lg shadow-violet-200/20">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">Navigator</p>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500" />
                        <span className="text-xs text-slate-400 font-medium">{answeredCount}/{questions.length}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {questions.map((_, index) => {
                        const isCurrent = index === currentQ;
                        const isAnswered = answers[index] !== null;
                        return (
                          <motion.button key={index} onClick={() => jumpToQuestion(index)}
                            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                            className={`h-9 rounded-xl text-xs font-black transition-all border-2 ${
                              isCurrent
                                ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white border-transparent shadow-md shadow-violet-300/40"
                                : isAnswered
                                ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200"
                                : "bg-white text-slate-500 border-slate-200 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600"
                            }`}>
                            {index + 1}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* legend */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1 font-semibold"><span className="h-2.5 w-2.5 rounded-md bg-gradient-to-br from-violet-600 to-fuchsia-600" />Current</span>
                      <span className="flex items-center gap-1 font-semibold"><span className="h-2.5 w-2.5 rounded-md bg-emerald-300 border border-emerald-400" />Done</span>
                      <span className="flex items-center gap-1 font-semibold"><span className="h-2.5 w-2.5 rounded-md bg-slate-200 border border-slate-300" />Skip</span>
                    </div>
                  </div>

                  {/* Finish now button */}
                  <button onClick={finishQuiz}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100 hover:border-amber-400">
                    <CheckCircle2 className="h-4 w-4" /> Finish & Submit
                  </button>
                </aside>
              </div>
            </motion.div>
          )}

          {/* ══════════ RESULT ══════════ */}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>

              {timeUp && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">Time's up! Your test has been auto-submitted.</p>
                </div>
              )}

              {/* score hero */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 sm:p-12 text-center mb-6 shadow-2xl shadow-violet-400/30">
                <div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl blob-glow-1" />
                <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl blob-glow-2" />
                <div className="relative z-10">
                  {/* animated ring gauge */}
                  <div className="mx-auto mb-6 relative h-44 w-44 sm:h-52 sm:w-52">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="12" />
                      <motion.circle cx="60" cy="60" r="52" fill="none" stroke="white" strokeWidth="12"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 52}
                        initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100) }}
                        transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.span className="text-5xl sm:text-6xl font-black text-white drop-shadow-lg"
                        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.7 }}>
                        {pct}%
                      </motion.span>
                      <span className="text-xs text-violet-200 mt-1 font-semibold">{score} / {questions.length}</span>
                    </div>
                  </div>

                  <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
                    className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                    {pct >= 80 ? "🎉 Excellent!" : pct >= 60 ? "👍 Good Job!" : pct >= 40 ? "💪 Keep Practicing!" : "🔥 Don't Give Up!"}
                  </motion.h2>
                  <p className="text-violet-200 text-sm mb-8">You answered {score} out of {questions.length} correctly</p>

                  {/* stat chips */}
                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                      { label: "Correct",  value: score, bg: "bg-emerald-500/25 border-emerald-400/40", text: "text-white" },
                      { label: "Wrong",    value: answers.filter((a, i) => a !== null && a !== questions[i]?.correct).length, bg: "bg-rose-500/25 border-rose-400/40", text: "text-white" },
                      { label: "Skipped",  value: answers.filter(a => a === null).length, bg: "bg-white/15 border-white/25", text: "text-white" },
                    ].map((stat, idx) => (
                      <motion.div key={stat.label}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.9 + idx * 0.1 }}
                        className={`rounded-2xl border-2 backdrop-blur-sm px-6 py-3 min-w-[100px] ${stat.bg}`}>
                        <div className={`text-3xl font-black ${stat.text}`}>{stat.value}</div>
                        <div className="text-xs text-violet-200 mt-0.5 font-semibold">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={restart}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 bg-white/15 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition hover:bg-white/25">
                      <Settings className="h-4 w-4" /> New Test
                    </button>
                    <button onClick={() => { setPhase("config"); startQuiz(); }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-violet-700 shadow-xl transition hover:bg-violet-50">
                      <RotateCcw className="h-4 w-4" /> Retry Same
                    </button>
                  </div>
                </div>
              </div>

              {/* ── ANSWER REVIEW ── */}
              <div className="rounded-3xl border-2 border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/20">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-lg font-bold text-slate-900">Answer Review</h3>
                  <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700">{questions.length} questions</span>
                </div>
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const userAns = answers[i];
                    const isCorrect = userAns === q.correct;
                    const isSkipped = userAns === null;
                    return (
                      <motion.div key={i}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`rounded-2xl border-2 p-4 sm:p-5 ${
                          isCorrect ? "border-emerald-300 bg-emerald-50"
                          : isSkipped ? "border-slate-200 bg-slate-50"
                          : "border-rose-300 bg-rose-50"
                        }`}>
                        <div className="flex items-start gap-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                            isCorrect ? "bg-emerald-500" : isSkipped ? "bg-slate-300" : "bg-rose-500"
                          }`}>
                            {isCorrect
                              ? <CheckCircle2 className="h-4 w-4 text-white" />
                              : <XCircle className="h-4 w-4 text-white" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Q{i + 1}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${subjectPill(q.subject)}`}>{q.subject}</span>
                              {isCorrect && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Correct ✓</span>}
                              {isSkipped && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Skipped</span>}
                              {!isCorrect && !isSkipped && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">Wrong ✗</span>}
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-2 leading-snug">{q.question}</p>

                            {/* show all options with highlights */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                              {q.options.map((opt, oi) => {
                                const isRight = oi === q.correct;
                                const isUser = oi === userAns;
                                return (
                                  <div key={oi} className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                                    isRight ? "bg-emerald-100 border-emerald-300 text-emerald-800" :
                                    isUser && !isRight ? "bg-rose-100 border-rose-300 text-rose-800" :
                                    "bg-white border-slate-200 text-slate-500"
                                  }`}>
                                    <span className="font-black mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
                                    {isRight && <span className="ml-1 font-black text-emerald-600">✓</span>}
                                    {isUser && !isRight && <span className="ml-1 font-black text-rose-600">✗</span>}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="rounded-xl border-2 border-violet-200 bg-violet-50 px-3 py-2.5 text-xs text-slate-700 leading-relaxed">
                              <span className="font-black text-violet-600">💡 Explanation: </span>{q.explanation}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </>
  );
};

export default Practice;
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw, Settings,
  Play, Target, BookOpen, AlertCircle, ArrowLeft, LogOut, Loader2, ChevronDown, FileText, Lock,
  PenTool, Send, Star, MessageSquare, TrendingUp, Quote, Lightbulb, Award, Zap, AlertTriangle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { apiClient, MCQ, type Subject, type USATCategory } from "@/services/api";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import ContentProtection from "@/components/ContentProtection";

const HAT_CATEGORY: USATCategory = {
  code: "HAT",
  title: "HAT Exam",
  description: "English/Verbal Reasoning, Analytical Reasoning, Quantitative Reasoning",
};

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

const OPTION_COLORS = [
  { idle: "bg-blue-100 text-blue-700 border-blue-200",      active: "bg-blue-600 text-white border-blue-600",      ring: "border-blue-400 bg-blue-50/80 shadow-blue-100" },
  { idle: "bg-violet-100 text-violet-700 border-violet-200", active: "bg-violet-600 text-white border-violet-600",  ring: "border-violet-400 bg-violet-50/80 shadow-violet-100" },
  { idle: "bg-cyan-100 text-cyan-700 border-cyan-200",       active: "bg-cyan-600 text-white border-cyan-600",      ring: "border-cyan-400 bg-cyan-50/80 shadow-cyan-100" },
  { idle: "bg-indigo-100 text-indigo-700 border-indigo-200", active: "bg-indigo-600 text-white border-indigo-600",  ring: "border-indigo-400 bg-indigo-50/80 shadow-indigo-100" },
];

const SUBJECT_PILLS: Record<string, { pill: string; dot: string }> = {
  English:     { pill: "bg-blue-100 text-blue-700 border-blue-200",       dot: "bg-blue-500" },
  Mathematics: { pill: "bg-violet-100 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  Physics:     { pill: "bg-amber-100 text-amber-700 border-amber-200",     dot: "bg-amber-500" },
  Chemistry:   { pill: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Biology:     { pill: "bg-rose-100 text-rose-700 border-rose-200",        dot: "bg-rose-500" },
};

const subjectPill = (s: string) => SUBJECT_PILLS[s]?.pill ?? "bg-slate-100 text-slate-600 border-slate-200";

const Practice = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"config" | "quiz" | "result" | "essay" | "essay-result">("config");
  const queryClient = useQueryClient();

  const [examMode, setExamMode] = useState<"usat" | "hat">("usat");

  const { data: categories = [] } = useQuery({
    queryKey: ["usat-categories"],
    queryFn: () => apiClient.listUSATCategories(),
    staleTime: 300_000, // 5 min — matches backend Redis TTL
    retry: false,
  });

  const [selectedCategory, setSelectedCategory] = useState<USATCategory | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Prefetch subjects for every category as soon as the category list lands —
  // so picking a category shows subjects instantly without a spinner.
  useEffect(() => {
    if (!categories.length) return;
    categories.forEach((cat) => {
      queryClient.prefetchQuery({
        queryKey: ["usat-subjects", cat.code],
        queryFn: () => apiClient.listUSATCategorySubjects(cat.code),
        staleTime: 300_000,
      });
    });
  }, [categories, queryClient]);

  const { data: rawSubjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["usat-subjects", selectedCategory?.code],
    queryFn: () => apiClient.listUSATCategorySubjects(selectedCategory!.code),
    enabled: !!selectedCategory,
    staleTime: 300_000,
    retry: false,
  });

  const isEssaySubject = (name: string) => /essay/i.test(name);
  const dbSubjects = rawSubjects.filter((s) => !isEssaySubject(s.name));

  const { data: hatRawSubjects = [], isLoading: loadingHATSubjects } = useQuery({
    queryKey: ["usat-subjects", "HAT"],
    queryFn: () => apiClient.listUSATCategorySubjects("HAT"),
    enabled: examMode === "hat",
    staleTime: 300_000,
    retry: false,
  });
  const hatSubjects = hatRawSubjects.filter((s) => !isEssaySubject(s.name));
  const activeSubjects = examMode === "hat" ? hatSubjects : dbSubjects;
  const loadingActiveSubjects = examMode === "hat" ? loadingHATSubjects : loadingSubjects;

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
  const [isPro, setIsPro] = useState(true);
  const [testsToday, setTestsToday] = useState(0);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);

  const [essayType, setEssayType] = useState<"argumentative" | "narrative">("argumentative");
  const [essayPrompt, setEssayPrompt] = useState<{ id: number; essay_type: string; prompt_text: string; max_score: number } | null>(null);
  const [essayText, setEssayText] = useState("");
  const [essayResult, setEssayResult] = useState<{
    score: number;
    max_score: number;
    feedback: string | {
      headline?: string;
      band?: string;
      overall_feedback: string;
      criteria: Array<{ name: string; score: number; comment: string }>;
      mistakes: Array<{ type: string; quote: string; issue: string; fix: string }>;
      strengths: string[];
      improvement_tips: string[];
      model_rewrite?: string;
      next_step_focus?: string;
    };
    essay_type: string;
  } | null>(null);
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayEvaluating, setEssayEvaluating] = useState(false);

  useEffect(() => {
    if (!apiClient.isAuthenticated()) return;
    apiClient.getPracticeStatus().then((status) => {
      setIsPro(status.is_pro);
      setTestsToday(status.tests_today);
      setDailyLimitReached(!status.is_pro && status.tests_today >= 1);
      if (!status.is_pro) setMcqCount(10);
    }).catch(() => {});
  }, []);

  const startQuiz = async () => {
    if (!apiClient.isAuthenticated()) { setAuthDialogOpen(true); return; }
    if (!selectedCategory && examMode !== "hat") return;
    const catCode = examMode === "hat" ? "HAT" : selectedCategory!.code;
    setFetchingMCQs(true);
    try {
      let tagged: { mcq: MCQ; subjectName: string }[] = [];
      if (selectedSubjectId) {
        const subjectName = activeSubjects.find((s) => s.id === selectedSubjectId)?.name ?? "Unknown";
        const mcqs = await apiClient.listSubjectPracticeMCQs(selectedSubjectId, mcqCount);
        tagged = mcqs.map((mcq) => ({ mcq, subjectName }));
      } else {
        const subjectIds = activeSubjects.map((s) => s.id);
        const mcqs = await apiClient.listCategoryPracticeMCQs(catCode, mcqCount, subjectIds);
        tagged = mcqs.map((mcq) => ({ mcq, subjectName: mcq.subject_name || "Unknown" }));
      }
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
    let attempted = 0;
    answers.forEach((a, i) => {
      if (a !== null && a !== undefined) {
        attempted++;
        if (a === questions[i]?.correct) s++;
      }
    });
    setScore(s); setPhase("result");
    // Only record the session if the user actually answered at least one question.
    // Skipped questions don't count toward attempted MCQs.
    if (attempted > 0) {
      apiClient.submitPracticeResult({
        total_questions: attempted,
        correct_answers: s,
        category: examMode === "hat" ? "HAT" : selectedCategory?.code,
        subject_name: selectedSubjectName === "All Subjects" ? undefined : selectedSubjectName,
      }).then(() => {
        if (!isPro) {
          setTestsToday((prev) => prev + 1);
          setDailyLimitReached(true);
        }
      }).catch(() => {});
    }
  }, [answers, questions, selectedCategory, selectedSubjectName, isPro]);

  useEffect(() => {
    if (phase !== "quiz" || timeLimit === 0) return;
    if (timeLeft <= 0) { setTimeUp(true); finishQuiz(); return; }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, timeLimit, finishQuiz]);

  useEffect(() => {
    if (phase === "quiz" || phase === "essay" || phase === "essay-result") window.scrollTo({ top: 0, behavior: "auto" });
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

  const startEssay = async (type: "argumentative" | "narrative") => {
    if (!apiClient.isAuthenticated()) { setAuthDialogOpen(true); return; }
    setEssayType(type);
    setEssayLoading(true);
    setEssayText("");
    setEssayResult(null);
    try {
      const prompt = await apiClient.getRandomEssayPrompt(type);
      setEssayPrompt(prompt);
      setPhase("essay");
    } catch (err: any) {
      alert(err.message || "Failed to load essay prompt");
    } finally {
      setEssayLoading(false);
    }
  };

  const submitEssay = async () => {
    if (!essayPrompt || !essayText.trim()) return;
    setEssayEvaluating(true);
    try {
      const result = await apiClient.evaluateEssay({
        essay_type: essayPrompt.essay_type,
        prompt_text: essayPrompt.prompt_text,
        user_essay: essayText,
      });
      setEssayResult(result);
      setPhase("essay-result");
    } catch (err: any) {
      alert(err.message || "Failed to evaluate essay");
    } finally {
      setEssayEvaluating(false);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const q = questions[currentQ];
  const selected = answers[currentQ] ?? null;
  const answeredCount = answers.filter(a => a !== null).length;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const progressPct = questions.length > 0 ? Math.round(((currentQ + 1) / questions.length) * 100) : 0;
  const essayWritingTheme = essayType === "narrative"
    ? {
      hero: "linear-gradient(135deg, #065f46 0%, #059669 42%, #10b981 72%, #14b8a6 100%)",
      heroShadow: "0 12px 40px rgba(5,150,105,0.34)",
      orb: "radial-gradient(circle, #a7f3d0, transparent 70%)",
      chipText: "text-emerald-100",
      descText: "text-emerald-100",
      promptBorder: "rgba(16,185,129,0.28)",
      promptIcon: "linear-gradient(135deg, #059669, #10b981)",
      promptLabel: "#059669",
      promptBox: "rounded-2xl border-l-4 border-emerald-400 bg-emerald-50/60 pl-5 pr-4 py-4",
    }
    : {
      hero: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #7c3aed 70%, #a855f7 100%)",
      heroShadow: "0 12px 40px rgba(109,40,217,0.4)",
      orb: "radial-gradient(circle, #c4b5fd, transparent 70%)",
      chipText: "text-purple-100",
      descText: "text-purple-200",
      promptBorder: "rgba(167,139,250,0.25)",
      promptIcon: "linear-gradient(135deg, #7c3aed, #a855f7)",
      promptLabel: "#7c3aed",
      promptBox: "rounded-2xl border-l-4 border-violet-400 bg-violet-50/60 pl-5 pr-4 py-4",
    };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');

        .practice-root { font-family: 'DM Sans', sans-serif; }
        .practice-heading { font-family: 'Bricolage Grotesque', sans-serif; }

        /* Page background */
        .practice-bg {
          background-color: #f0f5ff;
          background-image:
            radial-gradient(at 0% 0%, hsla(218,100%,95%,0.9) 0px, transparent 55%),
            radial-gradient(at 100% 0%, hsla(195,85%,94%,0.7) 0px, transparent 50%),
            radial-gradient(at 100% 100%, hsla(260,70%,96%,0.5) 0px, transparent 45%),
            radial-gradient(at 0% 100%, hsla(220,80%,95%,0.5) 0px, transparent 45%);
        }
        .dark .practice-bg {
          background-color: #060c1a;
          background-image:
            radial-gradient(at 0% 0%, hsla(218,80%,8%,0.9) 0px, transparent 55%),
            radial-gradient(at 100% 0%, hsla(195,70%,7%,0.7) 0px, transparent 50%);
        }

        /* Glass card */
        .g-card {
          background: rgba(255,255,255,0.95);
          border: 1.5px solid rgba(148,163,250,0.18);
          box-shadow: 0 4px 24px rgba(59,130,246,0.07), 0 1px 3px rgba(0,0,0,0.04);
        }
        .dark .g-card {
          background: rgba(15,23,42,0.95);
          border-color: rgba(99,102,241,0.15);
        }

        /* Hero gradient */
        .hero-gradient {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 35%, #0284c7 70%, #06b6d4 100%);
        }

        /* Animated progress bar glow */
        .progress-glow {
          box-shadow: 0 0 12px rgba(56,189,248,0.5);
        }

        /* Option card hover */
        .opt-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .opt-card:hover:not(.opt-selected) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59,130,246,0.12);
          border-color: rgba(96,165,250,0.5) !important;
        }
        .opt-selected {
          transform: translateY(-1px);
        }

        /* Nav button */
        .nav-btn {
          transition: all 0.15s ease;
        }
        .nav-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        /* Section label */
        .section-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #94a3b8;
        }

        /* Question progress dots */
        .q-dot-current { background: linear-gradient(135deg, #2563eb, #06b6d4); box-shadow: 0 2px 8px rgba(37,99,235,0.4); }
        .q-dot-done    { background: linear-gradient(135deg, #10b981, #34d399); box-shadow: 0 1px 4px rgba(16,185,129,0.3); }
        .q-dot-skip    { background: rgba(148,163,184,0.2); }

        /* Summary bar */
        .summary-bar {
          background: linear-gradient(135deg, rgba(239,246,255,0.9), rgba(236,254,255,0.8));
          border: 1.5px solid rgba(147,197,253,0.4);
        }
        .dark .summary-bar {
          background: rgba(30,58,138,0.15);
          border-color: rgba(37,99,235,0.2);
        }

        /* Score ring glow */
        @keyframes ring-glow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(56,189,248,0.4)); }
          50% { filter: drop-shadow(0 0 16px rgba(56,189,248,0.7)); }
        }
        .ring-animated { animation: ring-glow 2s ease-in-out infinite; }

        /* Essay textarea */
        .essay-area:focus {
          border-color: #60a5fa !important;
          box-shadow: 0 0 0 3px rgba(96,165,250,0.15), 0 4px 16px rgba(59,130,246,0.08);
        }

        /* Pill chip */
        .chip-active {
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 12px rgba(37,99,235,0.3);
        }

        /* Scrollbar */
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.3); border-radius: 4px; }

        /* Card hover lift */
        .card-lift {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .card-lift:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(59,130,246,0.14);
        }

        /* Gradient text */
        .grad-text {
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <Navbar />
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}
        message="Please log in first to start a practice test." />

      <ContentProtection>
      <div className="practice-root practice-bg relative min-h-screen overflow-hidden pt-24 pb-20">
        <div className="container relative z-10 mx-auto px-4 max-w-6xl">

          {/* ══════════ CONFIG ══════════ */}
          {phase === "config" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>

              {/* ── Hero ── */}
              <div className="relative mb-8 overflow-hidden rounded-3xl hero-gradient p-8 shadow-2xl shadow-blue-500/25">
                {/* Decorative orbs */}
                <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #bfdbfe, transparent 70%)" }} />
                <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #a5f3fc, transparent 70%)" }} />
                <div className="absolute top-4 right-1/3 h-20 w-20 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #e0f2fe, transparent 70%)" }} />

                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-sm">
                    <Settings className="h-3.5 w-3.5" /> Practice Test
                  </span>
                  <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-5xl">
                    Configure Your Test
                  </h1>
                  <p className="mt-2 text-sm font-medium text-blue-200">Pick your category, subject, questions and time — then hit start.</p>

                  {/* decorative pills row */}
                  <div className="mt-6 flex items-center gap-2 flex-wrap">
                    {["Category", "Subject", "Questions", "Timer", "Start!"].map((step, i) => (
                      <div key={step} className="flex items-center gap-2">
                        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-sm">
                          {step}
                        </span>
                        {i < 4 && <div className="h-px w-4 bg-white/25" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Config Card ── */}
              <div className="g-card rounded-3xl p-6 sm:p-8 space-y-8">

                {/* Exam Mode Toggle */}
                <div>
                  <p className="section-label mb-3">Exam</p>
                  <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100/60 p-1 dark:border-slate-700 dark:bg-slate-800/60">
                    {(["usat", "hat"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setExamMode(mode);
                          setSelectedCategory(null);
                          setSelectedSubjectId(null);
                          setSelectedSubjectName("All Subjects");
                        }}
                        className={`rounded-lg px-5 py-2 text-sm font-bold transition-all duration-200 ${
                          examMode === mode
                            ? mode === "hat"
                              ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow"
                              : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow"
                            : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                        }`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category (USAT only) */}
                {examMode === "usat" && (
                  <div>
                  <p className="section-label mb-3">Category</p>
                  <div className="relative sm:max-w-md">
                    <button type="button" onClick={() => setCategoryOpen(!categoryOpen)}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${
                        selectedCategory
                          ? "border-blue-400 bg-blue-50 text-blue-800 shadow-sm shadow-blue-100"
                          : "border-slate-200 bg-white/60 text-slate-500 hover:border-blue-300 hover:bg-blue-50/50"
                      }`}>
                      <span className="flex items-center gap-2">
                        {selectedCategory && (
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-200 text-[10px] font-black text-blue-800">
                            {selectedCategory.code.split("-")[1]}
                          </span>
                        )}
                        {selectedCategory ? `${selectedCategory.code} — ${selectedCategory.title}` : "Select a category…"}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${categoryOpen ? "rotate-180 text-blue-500" : "text-slate-400"}`} />
                    </button>

                    <AnimatePresence>
                      {categoryOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.98 }}
                          transition={{ duration: 0.15 }}
                          className="absolute z-20 mt-2 w-full max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-white shadow-2xl shadow-blue-100/50 custom-scroll"
                        >
                          {categories.map((cat, ci) => (
                            <motion.button
                              key={cat.code}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: ci * 0.03 }}
                              type="button"
                              onClick={() => { setSelectedCategory(cat); setCategoryOpen(false); }}
                              className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-blue-50/70 ${
                                selectedCategory?.code === cat.code ? "bg-blue-50" : ""
                              }`}
                            >
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-xs font-black text-white shadow-sm">
                                {cat.code.split("-")[1]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800">{cat.code} — {cat.title}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cat.description}</div>
                              </div>
                              {selectedCategory?.code === cat.code && (
                                <CheckCircle2 className="ml-auto h-4 w-4 text-blue-500 shrink-0 mt-1" />
                              )}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  </div>
                )} {/* end examMode === "usat" */}

                {/* Subject Pills — shown for USAT (when category selected) or always for HAT */}
                {(examMode === "hat" || selectedCategory) && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                    <p className="section-label mb-3">Subject</p>
                    {loadingActiveSubjects ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        <span>Loading subjects…</span>
                      </div>
                    ) : activeSubjects.length === 0 ? (
                      <p className="text-sm text-slate-400">No subjects found.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {["All Subjects", ...activeSubjects.map((s) => s.name)].map((s) => {
                          const isAll = s === "All Subjects";
                          const isActive = isAll ? selectedSubjectId === null : activeSubjects.find((ds) => ds.name === s)?.id === selectedSubjectId;
                          return (
                            <motion.button
                              key={s}
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                if (isAll) { setSelectedSubjectId(null); setSelectedSubjectName("All Subjects"); }
                                else { const found = activeSubjects.find((ds) => ds.name === s); setSelectedSubjectId(found?.id ?? null); setSelectedSubjectName(s); }
                              }}
                              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                                isActive
                                  ? examMode === "hat"
                                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white border-violet-600 shadow"
                                    : "chip-active"
                                  : "bg-white/70 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              }`}
                            >
                              {s}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* MCQ Count */}
                <div>
                  <p className="section-label mb-3">Number of Questions</p>
                  <div className="flex flex-wrap gap-2">
                    {mcqCountOptions.map(n => {
                      const locked = !isPro && n !== 10;
                      return (
                        <motion.button
                          key={n}
                          whileTap={!locked ? { scale: 0.94 } : {}}
                          onClick={() => !locked && setMcqCount(n)}
                          disabled={locked}
                          className={`relative w-14 py-3 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${
                            locked
                              ? "bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed"
                              : mcqCount === n
                                ? "chip-active"
                                : "bg-white/70 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                          }`}
                        >
                          {n}
                          {locked && <Lock className="absolute top-0.5 right-0.5 h-3 w-3 text-slate-400" />}
                        </motion.button>
                      );
                    })}
                  </div>
                  {!isPro && (
                    <p className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                      <Lock className="h-3 w-3" /> Free plan: 10 MCQs only. Upgrade to Pro for more!
                    </p>
                  )}
                </div>

                {/* Time */}
                <div>
                  <p className="section-label mb-3">Time Limit</p>
                  <div className="flex flex-wrap gap-2">
                    {timeOptions.map(t => (
                      <motion.button
                        key={t.value}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setTimeLimit(t.value)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border-2 ${
                          timeLimit === t.value
                            ? "chip-active"
                            : "bg-white/70 text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                        }`}
                      >
                        {t.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Summary strip */}
                <div className="summary-bar flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4">
                  {selectedCategory && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-[10px] font-black text-white shadow-sm">
                          {selectedCategory.code.split("-")[1]}
                        </span>
                        <span className="text-sm font-bold text-blue-800">{selectedCategory.code}</span>
                      </div>
                      <div className="h-4 w-px bg-blue-200" />
                    </>
                  )}
                  <div className="flex items-center gap-1.5 text-sm">
                    <BookOpen className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-slate-700">{selectedSubjectName}</span>
                  </div>
                  <div className="h-4 w-px bg-blue-200" />
                  <div className="flex items-center gap-1.5 text-sm">
                    <Target className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-slate-700">{mcqCount} MCQs</span>
                  </div>
                  <div className="h-4 w-px bg-blue-200" />
                  <div className="flex items-center gap-1.5 text-sm">
                    <Clock className="h-4 w-4 text-cyan-500" />
                    <span className="font-semibold text-slate-700">{timeLimit === 0 ? "Untimed" : `${timeLimit} min`}</span>
                  </div>
                </div>

                {dailyLimitReached && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 rounded-2xl border-2 border-amber-300/80 bg-amber-50 px-5 py-4 shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200">
                      <Lock className="h-4 w-4 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Daily limit reached</p>
                      <p className="text-xs text-amber-600 mt-0.5">Free users can take 1 practice test per day. Upgrade to Pro for unlimited tests!</p>
                    </div>
                  </motion.div>
                )}

                {/* Start Button */}
                <motion.button
                  whileTap={!fetchingMCQs && (selectedCategory || examMode === "hat") && !dailyLimitReached ? { scale: 0.98 } : {}}
                  onClick={startQuiz}
                  disabled={fetchingMCQs || (!selectedCategory && examMode !== "hat") || dailyLimitReached}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-bold text-white shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: fetchingMCQs || (!selectedCategory && examMode !== "hat") || dailyLimitReached
                      ? "linear-gradient(135deg, #6b7280, #9ca3af)"
                      : examMode === "hat"
                        ? "linear-gradient(135deg, #7c3aed, #a855f7, #6d28d9)"
                        : "linear-gradient(135deg, #1d4ed8, #0284c7, #06b6d4)",
                    boxShadow: !fetchingMCQs && (selectedCategory || examMode === "hat") && !dailyLimitReached
                      ? examMode === "hat"
                        ? "0 8px 28px rgba(124,58,237,0.4), 0 2px 8px rgba(168,85,247,0.2)"
                        : "0 8px 28px rgba(37,99,235,0.4), 0 2px 8px rgba(6,182,212,0.2)"
                      : "none",
                  }}
                >
                  {fetchingMCQs
                    ? <><Loader2 className="h-5 w-5 animate-spin" /> Loading MCQs…</>
                    : dailyLimitReached
                      ? <><Lock className="h-5 w-5" /> Daily Limit Reached</>
                      : <><Play className="h-5 w-5" /> Start Practice Test</>
                  }
                </motion.button>
              </div>

              {/* ── Bottom Cards Row ── */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* Mock Test Card */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="g-card card-lift rounded-3xl p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg"
                      style={{ background: "linear-gradient(135deg, #0284c7, #2563eb)", boxShadow: "0 4px 16px rgba(2,132,199,0.35)" }}>
                      <FileText className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="practice-heading text-base font-extrabold text-slate-800">Full Mock Test</h3>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                        {examMode === "hat"
                          ? "100 MCQs — English/Verbal 30%, Analytical 30%, Quantitative 40% — timed, instant score."
                          : "75 MCQs + 2 Essays — timed, AI-evaluated, with detailed feedback."}
                      </p>
                      {!isPro ? (
                        <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                          <Lock className="h-3 w-3" /> Pro feature — upgrade to unlock
                        </div>
                      ) : (
                        <button
                          onClick={() => navigate(examMode === "hat" ? "/mock-test?category=HAT" : `/mock-test${selectedCategory ? `?category=${selectedCategory.code}` : ""}`)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
                          style={{ background: examMode === "hat" ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "linear-gradient(135deg, #0284c7, #2563eb)", boxShadow: examMode === "hat" ? "0 4px 14px rgba(124,58,237,0.35)" : "0 4px 14px rgba(2,132,199,0.35)" }}
                        >
                          <Play className="h-4 w-4" /> Take Mock Test
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Essay Practice Card — hidden in HAT mode (no essays) */}
                {examMode !== "hat" && <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="g-card card-lift rounded-3xl p-6"
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
                      <PenTool className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="practice-heading text-base font-extrabold text-slate-800">Essay Practice</h3>
                      <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                        Write an essay and get instant AI feedback with detailed scoring.
                      </p>
                    </div>
                  </div>

                  {!isPro ? (
                    <div className="flex items-center gap-3 rounded-2xl border-2 border-amber-300/80 bg-amber-50 px-4 py-3">
                      <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-800">Pro Feature</p>
                        <p className="text-xs text-amber-600">AI-evaluated essay practice is available for Pro users only.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => startEssay("argumentative")}
                          disabled={essayLoading}
                          className="group relative rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 p-4 text-left transition-all duration-200 hover:border-violet-400 hover:shadow-lg hover:shadow-violet-100/60 hover:-translate-y-0.5 active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-200 text-xs font-black text-violet-700">A</span>
                            <span className="text-xs font-extrabold text-violet-800">Argumentative</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">Present & defend a position with evidence.</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-violet-500 bg-violet-100 px-2 py-0.5 rounded-full">Max: 15pts</span>
                            <ArrowRight className="h-3.5 w-3.5 text-violet-400 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </motion.button>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => startEssay("narrative")}
                          disabled={essayLoading}
                          className="group relative rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-left transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100/60 hover:-translate-y-0.5 active:scale-[0.98]"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-200 text-xs font-black text-emerald-700">N</span>
                            <span className="text-xs font-extrabold text-emerald-800">Narrative</span>
                          </div>
                          <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">Tell a story with vivid details & plot.</p>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full">Max: 10pts</span>
                            <ArrowRight className="h-3.5 w-3.5 text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </motion.button>
                      </div>
                      {essayLoading && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-violet-600 font-semibold">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading essay prompt…
                        </div>
                      )}
                    </>
                  )}
                </motion.div>}
              </div>
            </motion.div>
          )}

          {/* ══════════ QUIZ ══════════ */}
          {phase === "quiz" && q && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>

              {/* ── Progress / Header Bar ── */}
              <div className="g-card mb-6 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  {/* Left: back + quit */}
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={restart}
                      className="nav-btn inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={restart}
                      className="nav-btn inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100 hover:border-rose-300"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Quit
                    </motion.button>
                  </div>

                  {/* Center: Q counter + subject */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-black text-slate-700">
                      Q <span className="grad-text">{currentQ + 1}</span>/{questions.length}
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full border-2 font-bold ${subjectPill(q.subject)}`}>
                      {q.subject}
                    </span>
                  </div>

                  {/* Timer */}
                  {timeLimit > 0 ? (
                    <span className={`font-mono text-sm font-black flex items-center gap-1.5 rounded-xl px-4 py-2 border-2 transition-colors duration-300 ${
                      timeLeft < 60
                        ? "text-rose-700 bg-rose-50 border-rose-200 animate-pulse"
                        : timeLeft < 180
                          ? "text-amber-700 bg-amber-50 border-amber-200"
                          : "text-emerald-700 bg-emerald-50 border-emerald-200"
                    }`}>
                      <Clock className="h-3.5 w-3.5" /> {formatTime(timeLeft)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 font-bold">
                      <Clock className="h-3.5 w-3.5" /> Untimed
                    </div>
                  )}
                </div>

                {/* Main progress bar */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full progress-glow"
                      style={{ background: "linear-gradient(90deg, #2563eb, #06b6d4)" }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs font-black grad-text min-w-[36px] text-right">{progressPct}%</span>
                </div>

                {/* Mini question dots */}
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5 flex-1 overflow-hidden">
                    {questions.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => jumpToQuestion(idx)}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-200 hover:opacity-80 ${
                          idx === currentQ ? "q-dot-current" :
                          answers[idx] !== null ? "q-dot-done" :
                          "q-dot-skip"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold shrink-0 ml-1">{answeredCount}/{questions.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6 items-start">

                {/* ── Question Card ── */}
                <div>
                  <div key={currentQ} className="g-card rounded-3xl p-6 sm:p-8">
                      {/* Question header */}
                      <div className="flex items-center gap-3 mb-6">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black text-white shadow-lg"
                          style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
                        >
                          {String(currentQ + 1).padStart(2, "0")}
                        </div>
                        <div>
                          <p className="section-label">Question {currentQ + 1} of {questions.length}</p>
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full border font-bold mt-0.5 ${subjectPill(q.subject)}`}>
                            {q.subject}
                          </span>
                        </div>
                      </div>

                      {/* Question text */}
                      <div className="mb-7 rounded-2xl border-l-4 border-blue-400 bg-gradient-to-r from-blue-50/60 to-transparent pl-5 pr-4 py-4">
                        <p className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">{q.question}</p>
                      </div>

                      {/* Options */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, i) => {
                          const isSelected = selected === i;
                          const C = OPTION_COLORS[i];
                          return (
                            <button
                              key={i}
                              onClick={() => handleSelect(i)}
                              className={`opt-card relative text-left p-4 rounded-2xl border-2 flex items-start gap-3 group active:scale-[0.98] ${
                                isSelected
                                  ? `${C.ring} shadow-lg opt-selected`
                                  : "border-slate-200 bg-white/70"
                              }`}
                            >
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black border-2 transition-all duration-150 ${
                                isSelected ? C.active : `${C.idle} group-hover:scale-105`
                              }`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className={`text-sm font-semibold leading-snug flex-1 pt-0.5 ${isSelected ? "text-slate-900" : "text-slate-700"}`}>
                                {opt}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Prev / Next */}
                      <div className="mt-6 flex items-center gap-3">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={prevQ}
                          disabled={currentQ === 0}
                          className="nav-btn flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white/70 px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        >
                          <ArrowLeft className="h-4 w-4" /> Prev
                        </motion.button>
                        <div className="flex-1" />
                        {currentQ < questions.length - 1 ? (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={nextQ}
                            className="nav-btn flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md"
                            style={{ background: "linear-gradient(135deg, #2563eb, #0ea5e9)", boxShadow: "0 4px 12px rgba(37,99,235,0.3)" }}
                          >
                            Next <ArrowRight className="h-4 w-4" />
                          </motion.button>
                        ) : (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={finishQuiz}
                            className="nav-btn flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md"
                            style={{ background: "linear-gradient(135deg, #059669, #10b981)", boxShadow: "0 4px 12px rgba(5,150,105,0.3)" }}
                          >
                            Submit <CheckCircle2 className="h-4 w-4" />
                          </motion.button>
                        )}
                      </div>
                  </div>
                </div>

                {/* ── Sidebar ── */}
                <aside className="lg:sticky lg:top-28 space-y-4">

                  {/* Navigator */}
                  <div className="g-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">Navigator</p>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }} />
                        <span className="text-xs text-slate-400 font-semibold">{answeredCount}/{questions.length} done</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 mb-4">
                      {questions.map((_, index) => {
                        const isCurrent = index === currentQ;
                        const isAnswered = answers[index] !== null;
                        return (
                          <motion.button
                            key={index}
                            onClick={() => jumpToQuestion(index)}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.9 }}
                            className={`h-9 rounded-xl text-xs font-black transition-all border-2 ${
                              isCurrent
                                ? "text-white border-transparent shadow-md"
                                : isAnswered
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                            }`}
                            style={isCurrent ? {
                              background: "linear-gradient(135deg, #2563eb, #06b6d4)",
                              boxShadow: "0 3px 10px rgba(37,99,235,0.35)"
                            } : {}}
                          >
                            {index + 1}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-3 border-t border-slate-100">
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="h-2.5 w-2.5 rounded-md" style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)" }} />Current
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="h-2.5 w-2.5 rounded-md bg-emerald-300 border border-emerald-400" />Done
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <span className="h-2.5 w-2.5 rounded-md bg-slate-200 border border-slate-300" />Skip
                      </span>
                    </div>
                  </div>

                  {/* Finish button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={finishQuiz}
                    className="nav-btn w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 py-3 text-sm font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-400"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Finish & Submit
                  </motion.button>
                </aside>
              </div>
            </motion.div>
          )}

          {/* ══════════ RESULT ══════════ */}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>

              {timeUp && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 shadow-sm"
                >
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm font-semibold text-amber-800">Time's up! Your test has been auto-submitted.</p>
                </motion.div>
              )}

              {/* Score Hero */}
              <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center mb-6 shadow-2xl"
                style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 35%, #0284c7 70%, #06b6d4 100%)", boxShadow: "0 16px 48px rgba(30,58,138,0.4)" }}>
                {/* Orb decorations */}
                <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #bfdbfe, transparent 70%)" }} />
                <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #a5f3fc, transparent 70%)" }} />

                <div className="relative z-10">
                  {/* Ring gauge */}
                  <div className="mx-auto mb-6 relative h-44 w-44 sm:h-52 sm:w-52 ring-animated">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                      <motion.circle cx="60" cy="60" r="52" fill="none"
                        stroke="white" strokeWidth="10" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 52}
                        initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                        animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - pct / 100) }}
                        transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <motion.span
                        className="practice-heading text-5xl sm:text-6xl font-black text-white drop-shadow-lg"
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.8 }}
                      >
                        {pct}%
                      </motion.span>
                      <span className="text-xs text-blue-200 mt-1 font-semibold">{score} / {questions.length}</span>
                    </div>
                  </div>

                  <motion.h2
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
                    className="practice-heading text-2xl sm:text-3xl font-extrabold text-white mb-1"
                  >
                    {pct >= 80 ? "🎉 Excellent!" : pct >= 60 ? "👍 Good Job!" : pct >= 40 ? "💪 Keep Practicing!" : "🔥 Don't Give Up!"}
                  </motion.h2>
                  <p className="text-blue-200 text-sm mb-8">You answered {score} out of {questions.length} correctly</p>

                  {/* Stat chips */}
                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                      { label: "Correct",  value: score, bg: "bg-emerald-500/20 border-emerald-400/40" },
                      { label: "Wrong",    value: answers.filter((a, i) => a !== null && a !== questions[i]?.correct).length, bg: "bg-rose-500/20 border-rose-400/40" },
                      { label: "Skipped",  value: answers.filter(a => a === null).length, bg: "bg-white/12 border-white/20" },
                    ].map((stat, idx) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 1.0 + idx * 0.1 }}
                        className={`rounded-2xl border-2 backdrop-blur-sm px-6 py-3 min-w-[90px] ${stat.bg}`}
                      >
                        <div className="practice-heading text-3xl font-black text-white">{stat.value}</div>
                        <div className="text-xs text-blue-200 mt-0.5 font-semibold">{stat.label}</div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={restart}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 bg-white/12 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                    >
                      <Settings className="h-4 w-4" /> New Test
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setPhase("config"); startQuiz(); }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-blue-700 shadow-xl transition hover:bg-blue-50"
                    >
                      <RotateCcw className="h-4 w-4" /> Retry Same
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Answer Review */}
              <div className="g-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="practice-heading text-lg font-bold text-slate-900">Answer Review</h3>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200">{questions.length} questions</span>
                </div>
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const userAns = answers[i];
                    const isCorrect = userAns === q.correct;
                    const isSkipped = userAns === null;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        className={`rounded-2xl border-2 p-4 sm:p-5 transition-all ${
                          isCorrect ? "border-emerald-200 bg-emerald-50/60"
                          : isSkipped ? "border-slate-200 bg-slate-50/60"
                          : "border-rose-200 bg-rose-50/60"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                            isCorrect ? "bg-emerald-500" : isSkipped ? "bg-slate-300" : "bg-rose-500"
                          }`}>
                            {isCorrect
                              ? <CheckCircle2 className="h-4 w-4 text-white" />
                              : <XCircle className="h-4 w-4 text-white" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Q{i + 1}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${subjectPill(q.subject)}`}>{q.subject}</span>
                              {isCorrect && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">Correct ✓</span>}
                              {isSkipped && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">Skipped</span>}
                              {!isCorrect && !isSkipped && <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">Wrong ✗</span>}
                            </div>
                            <p className="text-sm font-bold text-slate-800 mb-3 leading-snug">{q.question}</p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                              {q.options.map((opt, oi) => {
                                const isRight = oi === q.correct;
                                const isUser = oi === userAns;
                                return (
                                  <div key={oi} className={`rounded-xl px-3 py-2 text-xs font-semibold border-2 ${
                                    isRight ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : isUser && !isRight ? "bg-rose-50 border-rose-200 text-rose-800"
                                    : "bg-white/70 border-slate-200 text-slate-500"
                                  }`}>
                                    <span className="font-black mr-1">{String.fromCharCode(65 + oi)}.</span>{opt}
                                    {isRight && <span className="ml-1.5 font-black text-emerald-600">✓</span>}
                                    {isUser && !isRight && <span className="ml-1.5 font-black text-rose-600">✗</span>}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="rounded-xl border-2 border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs text-slate-700 leading-relaxed">
                              <span className="font-black text-blue-600">💡 </span>{q.explanation}
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

          {/* ══════════ ESSAY WRITING ══════════ */}
          {phase === "essay" && essayPrompt && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>

              {/* Essay Hero */}
              <div className="relative mb-6 overflow-hidden rounded-3xl p-8 shadow-2xl"
                style={{ background: essayWritingTheme.hero, boxShadow: essayWritingTheme.heroShadow }}>
                <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full opacity-20" style={{ background: essayWritingTheme.orb }} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      onClick={restart}
                      className="inline-flex items-center gap-1.5 rounded-xl border-2 border-white/25 bg-white/15 backdrop-blur-sm px-3 py-2 text-xs font-bold text-white transition hover:bg-white/25"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back
                    </button>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold ${essayWritingTheme.chipText} backdrop-blur-sm`}>
                      <PenTool className="h-3.5 w-3.5" /> {essayType === "argumentative" ? "Argumentative" : "Narrative"} Essay
                    </span>
                    <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold ${essayWritingTheme.chipText} backdrop-blur-sm`}>
                      <Star className="h-3.5 w-3.5 text-amber-300" /> Max: {essayPrompt.max_score} pts
                    </span>
                  </div>
                  <h1 className="practice-heading text-3xl font-extrabold tracking-tight text-white drop-shadow">Write Your Essay</h1>
                  <p className={`mt-2 text-sm font-medium ${essayWritingTheme.descText}`}>Read the prompt carefully, then craft your response below.</p>
                </div>
              </div>

              {/* Prompt Card */}
              <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: essayWritingTheme.promptBorder }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: essayWritingTheme.promptIcon }}>
                    <MessageSquare className="h-3.5 w-3.5 text-white" />
                  </div>
                  <p className="section-label" style={{ color: essayWritingTheme.promptLabel }}>Essay Prompt</p>
                </div>
                <div className={essayWritingTheme.promptBox}>
                  <p className="text-base font-bold text-slate-900 leading-relaxed">{essayPrompt.prompt_text}</p>
                </div>
              </div>

              {/* Writing Area */}
              <div className="g-card rounded-3xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="section-label">Your Response</p>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1">
                    {essayText.trim().split(/\s+/).filter(Boolean).length} words
                  </span>
                </div>
                <textarea
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                  placeholder="Start writing your essay here…"
                  className="essay-area w-full min-h-[320px] rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-5 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none transition-all resize-y"
                />
                {essayText.trim().length > 0 && essayText.trim().split(/\s+/).filter(Boolean).length < 20 && (
                  <p className="mt-2.5 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3" /> Write at least 20 words to submit your essay.
                  </p>
                )}
                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={restart}
                    className="nav-btn flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white/70 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <ArrowLeft className="h-4 w-4" /> Cancel
                  </button>
                  <div className="flex-1" />
                  <motion.button
                    whileTap={!essayEvaluating && essayText.trim().split(/\s+/).filter(Boolean).length >= 20 ? { scale: 0.97 } : {}}
                    onClick={submitEssay}
                    disabled={essayEvaluating || essayText.trim().split(/\s+/).filter(Boolean).length < 20}
                    className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{ background: "linear-gradient(135deg, #6d28d9, #a855f7)", boxShadow: "0 4px 16px rgba(109,40,217,0.35)" }}
                  >
                    {essayEvaluating
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating…</>
                      : <><Send className="h-4 w-4" /> Submit for AI Evaluation</>
                    }
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════ ESSAY RESULT ══════════ */}
          {phase === "essay-result" && essayResult && essayPrompt && (() => {
            const fb = typeof essayResult.feedback === "object" ? essayResult.feedback : null;
            const pctScore = (essayResult.score / essayResult.max_score) * 100;
            const mistakeColors: Record<string, { bg: string; text: string; border: string }> = {
              grammar:    { bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200" },
              spelling:   { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
              logic:      { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
              structure:  { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200" },
              style:      { bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200" },
              vocabulary: { bg: "bg-cyan-50",   text: "text-cyan-700",   border: "border-cyan-200" },
              coherence:  { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" },
            };
            return (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>

                {/* Score Hero */}
                <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center mb-6 shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 40%, #7c3aed 70%, #a855f7 100%)", boxShadow: "0 16px 48px rgba(109,40,217,0.4)" }}>
                  <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #c4b5fd, transparent 70%)" }} />
                  <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #e9d5ff, transparent 70%)" }} />

                  <div className="relative z-10">
                    <div className="mx-auto mb-6 relative h-44 w-44 sm:h-52 sm:w-52 ring-animated">
                      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
                        <motion.circle cx="60" cy="60" r="52" fill="none"
                          stroke="white" strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 52}
                          initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - essayResult.score / essayResult.max_score) }}
                          transition={{ duration: 1.6, ease: "easeOut", delay: 0.3 }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          className="practice-heading text-5xl sm:text-6xl font-black text-white drop-shadow-lg"
                          initial={{ opacity: 0, scale: 0.4 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.5, delay: 0.8 }}
                        >
                          {essayResult.score}
                        </motion.span>
                        <span className="text-xs text-purple-200 mt-1 font-semibold">out of {essayResult.max_score}</span>
                      </div>
                    </div>

                    <motion.h2
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
                      className="practice-heading text-2xl sm:text-3xl font-extrabold text-white mb-1"
                    >
                      {pctScore >= 80 ? "🎉 Excellent Essay!" : pctScore >= 60 ? "👍 Good Work!" : pctScore >= 40 ? "💪 Keep Improving!" : "🔥 Keep Practicing!"}
                    </motion.h2>
                    <p className="text-purple-200 text-sm mb-3 capitalize">{essayResult.essay_type} Essay</p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={restart}
                        className="flex items-center justify-center gap-2 rounded-2xl border-2 border-white/25 bg-white/12 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
                      >
                        <Settings className="h-4 w-4" /> Back to Practice
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => startEssay(essayType)}
                        className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-violet-700 shadow-xl transition hover:bg-violet-50"
                      >
                        <RotateCcw className="h-4 w-4" /> Try Another
                      </motion.button>
                    </div>
                  </div>
                </div>

                {/* Overall Feedback */}
                <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: "rgba(167,139,250,0.25)" }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                      style={{ background: "linear-gradient(135deg, #6d28d9, #a855f7)", boxShadow: "0 4px 14px rgba(109,40,217,0.3)" }}>
                      <Star className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="practice-heading text-base font-extrabold text-slate-800">AI Feedback</h3>
                      <p className="text-xs text-slate-400">Detailed evaluation of your essay</p>
                    </div>
                    {fb?.band && (
                      <span className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider border-2 border-violet-200 bg-violet-100 text-violet-700">
                        {fb.band}
                      </span>
                    )}
                  </div>
                  {fb?.headline && (
                    <p className="mb-3 text-base font-bold text-slate-900 leading-snug">“{fb.headline}”</p>
                  )}
                  <div className="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-5 text-sm text-slate-700 leading-relaxed">
                    {fb ? fb.overall_feedback : (typeof essayResult.feedback === "string" ? essayResult.feedback : "Evaluation complete.")}
                  </div>
                </div>

                {/* Criteria Breakdown */}
                {fb && fb.criteria.length > 0 && (
                  <div className="g-card rounded-3xl p-6 sm:p-8 mb-5">
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #2563eb, #06b6d4)", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}>
                        <Target className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="practice-heading text-base font-extrabold text-slate-800">Score Breakdown</h3>
                        <p className="text-xs text-slate-400">Performance across each criterion</p>
                      </div>
                    </div>
                    <div className="space-y-5">
                      {fb.criteria.map((c, i) => {
                        const maxC = essayResult.essay_type === "argumentative"
                          ? [5, 3, 3, 2, 2][i] ?? 3
                          : [3, 2, 2, 2, 1][i] ?? 2;
                        const p = maxC > 0 ? (c.score / maxC) * 100 : 0;
                        const barGrad = p >= 75
                          ? "linear-gradient(90deg, #059669, #10b981)"
                          : p >= 50
                            ? "linear-gradient(90deg, #d97706, #fbbf24)"
                            : "linear-gradient(90deg, #dc2626, #f87171)";
                        const scoreColor = p >= 75 ? "#059669" : p >= 50 ? "#d97706" : "#dc2626";
                        return (
                          <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i + 0.3 }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold text-slate-700">{c.name}</span>
                              <span className="text-sm font-black" style={{ color: scoreColor }}>{c.score}/{maxC}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ background: barGrad }}
                                initial={{ width: 0 }}
                                animate={{ width: `${p}%` }}
                                transition={{ duration: 0.8, delay: 0.1 * i + 0.5, ease: "easeOut" }}
                              />
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">{c.comment}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Strengths */}
                {fb && fb.strengths.length > 0 && (
                  <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: "rgba(52,211,153,0.25)" }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #059669, #34d399)", boxShadow: "0 4px 14px rgba(5,150,105,0.3)" }}>
                        <Award className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="practice-heading text-base font-extrabold text-slate-800">What You Did Well</h3>
                        <p className="text-xs text-slate-400">Keep doing these</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {fb.strengths.map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i + 0.3 }}
                          className="flex gap-3 items-start rounded-2xl border-2 border-emerald-100 bg-emerald-50/60 p-4">
                          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-sm text-slate-700 leading-relaxed">{s}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mistakes */}
                {fb && fb.mistakes.length > 0 && (
                  <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: "rgba(252,165,165,0.3)" }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #dc2626, #f87171)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}>
                        <AlertTriangle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="practice-heading text-base font-extrabold text-slate-800">Mistakes Found</h3>
                        <p className="text-xs text-slate-400">Specific issues with fixes</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {fb.mistakes.map((m, i) => {
                        const mColor = mistakeColors[m.type] || mistakeColors.grammar;
                        return (
                          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i + 0.3 }}
                            className={`rounded-2xl border-2 ${mColor.border} ${mColor.bg} p-5`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${mColor.border} ${mColor.text}`}>
                                {m.type}
                              </span>
                            </div>
                            {m.quote && (
                              <div className="flex gap-2 items-start mb-3 rounded-xl bg-white/70 border border-slate-200 p-3">
                                <Quote className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-600 italic">"{m.quote}"</p>
                              </div>
                            )}
                            <div className="space-y-2">
                              <div className="flex gap-2 items-start">
                                <XCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700"><span className="font-bold">Issue:</span> {m.issue}</p>
                              </div>
                              <div className="flex gap-2 items-start">
                                <Zap className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-sm text-slate-700"><span className="font-bold">Fix:</span> {m.fix}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Improvement Tips */}
                {fb && fb.improvement_tips.length > 0 && (
                  <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: "rgba(251,191,36,0.3)" }}>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)", boxShadow: "0 4px 14px rgba(217,119,6,0.3)" }}>
                        <Lightbulb className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="practice-heading text-base font-extrabold text-slate-800">How to Improve</h3>
                        <p className="text-xs text-slate-400">Actionable tips for your next essay</p>
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      {fb.improvement_tips.map((tip, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i + 0.3 }}
                          className="flex gap-3 items-start rounded-2xl border-2 border-amber-100 bg-amber-50/60 p-4">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white mt-0.5"
                            style={{ background: "linear-gradient(135deg, #d97706, #f59e0b)" }}>
                            {i + 1}
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model Rewrite */}
                {fb?.model_rewrite && (
                  <div className="g-card rounded-3xl p-6 sm:p-8 mb-5" style={{ borderColor: "rgba(16,185,129,0.25)" }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #047857, #10b981)", boxShadow: "0 4px 14px rgba(4,120,87,0.3)" }}>
                        <PenTool className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="practice-heading text-base font-extrabold text-slate-800">Model Rewrite</h3>
                        <p className="text-xs text-slate-400">Your weakest paragraph, strengthened — in your voice</p>
                      </div>
                    </div>
                    <div className="rounded-2xl border-2 border-emerald-100 bg-emerald-50/60 p-5 text-sm text-slate-800 leading-relaxed italic">
                      “{fb.model_rewrite}”
                    </div>
                  </div>
                )}

                {/* Next Step Focus */}
                {fb?.next_step_focus && (
                  <div className="rounded-3xl p-5 sm:p-6 mb-5 border-2"
                    style={{ background: "linear-gradient(135deg, #eef2ff, #fdf4ff)", borderColor: "rgba(139,92,246,0.3)" }}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-md"
                        style={{ background: "linear-gradient(135deg, #4f46e5, #a855f7)" }}>
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mb-1">Focus next time</p>
                        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{fb.next_step_focus}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Submission Review */}
                <div className="g-card rounded-3xl p-6 sm:p-8">
                  <p className="section-label mb-4">Your Submission</p>
                  <div className="rounded-2xl border-2 border-violet-100 bg-violet-50/50 p-4 mb-4">
                    <p className="section-label mb-2" style={{ color: "#7c3aed" }}>Prompt</p>
                    <p className="text-sm font-semibold text-slate-800 leading-relaxed">{essayPrompt.prompt_text}</p>
                  </div>
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="section-label">Your Essay</p>
                      <span className="text-xs font-semibold text-slate-400 bg-white/70 rounded-lg px-2 py-0.5">
                        {essayText.trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{essayText}</p>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </div>
      </div>
      </ContentProtection>
    </>
  );
};

export default Practice;
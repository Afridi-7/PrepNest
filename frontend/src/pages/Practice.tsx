import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw, Settings, Play, Target, BookOpen, AlertCircle, ArrowLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import { apiClient } from "@/services/api";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";

const allQuestions = [
  { question: "Which of the following is the correct meaning of 'Ubiquitous'?", options: ["Rare", "Present everywhere", "Ancient", "Mysterious"], correct: 1, subject: "English" },
  { question: "If 3x + 7 = 22, what is the value of x?", options: ["3", "5", "7", "15"], correct: 1, subject: "Mathematics" },
  { question: "Newton's Third Law states that:", options: ["F = ma", "Every action has an equal and opposite reaction", "Energy is conserved", "Objects at rest stay at rest"], correct: 1, subject: "Physics" },
  { question: "What is the chemical formula for water?", options: ["CO₂", "H₂O", "NaCl", "O₂"], correct: 1, subject: "Chemistry" },
  { question: "The powerhouse of the cell is:", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Body"], correct: 2, subject: "Biology" },
  { question: "Choose the correct sentence:", options: ["He don't know nothing.", "He doesn't know anything.", "He don't know anything.", "He doesn't knows anything."], correct: 1, subject: "English" },
  { question: "What is 15% of 200?", options: ["25", "30", "35", "40"], correct: 1, subject: "Mathematics" },
  { question: "The SI unit of force is:", options: ["Joule", "Watt", "Newton", "Pascal"], correct: 2, subject: "Physics" },
  { question: "Which gas is most abundant in Earth's atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correct: 1, subject: "Chemistry" },
  { question: "DNA stands for:", options: ["Deoxyribonucleic Acid", "Dinitro Acid", "Deoxyribo Nuclear Acid", "None"], correct: 0, subject: "Biology" },
  { question: "The synonym of 'Eloquent' is:", options: ["Silent", "Articulate", "Rude", "Slow"], correct: 1, subject: "English" },
  { question: "Solve: 2² + 3² = ?", options: ["10", "13", "12", "25"], correct: 1, subject: "Mathematics" },
  { question: "Speed of light is approximately:", options: ["3×10⁶ m/s", "3×10⁸ m/s", "3×10¹⁰ m/s", "3×10⁴ m/s"], correct: 1, subject: "Physics" },
  { question: "The pH of pure water is:", options: ["0", "7", "14", "1"], correct: 1, subject: "Chemistry" },
  { question: "Photosynthesis occurs in:", options: ["Mitochondria", "Chloroplast", "Nucleus", "Ribosome"], correct: 1, subject: "Biology" },
  { question: "Antonym of 'Benevolent':", options: ["Kind", "Generous", "Malevolent", "Gentle"], correct: 2, subject: "English" },
  { question: "If x² = 49, then x = ?", options: ["±7", "7", "49", "±49"], correct: 0, subject: "Mathematics" },
  { question: "Which planet is closest to the Sun?", options: ["Venus", "Earth", "Mercury", "Mars"], correct: 2, subject: "Physics" },
  { question: "Common salt is:", options: ["KCl", "NaCl", "CaCl₂", "MgCl₂"], correct: 1, subject: "Chemistry" },
  { question: "The basic unit of life is:", options: ["Atom", "Molecule", "Cell", "Organ"], correct: 2, subject: "Biology" },
];

const buildExplanation = (correctOption: string, subject: string) => {
  const templates: Record<string, string> = {
    English: `In English, meaning and context are key. The correct choice is "${correctOption}" because it best matches the grammar or vocabulary usage in the question.`,
    Mathematics: `Use the core math rule in the question and simplify step by step. This leads to "${correctOption}" as the correct result.`,
    Physics: `Apply the relevant physics concept or law directly. With the standard definition, "${correctOption}" is correct.`,
    Chemistry: `Using standard chemical facts and notation, the correct answer is "${correctOption}".`,
    Biology: `From basic biology definitions and functions, "${correctOption}" is the correct option.`,
  };
  return templates[subject] || `For this question, the correct answer is "${correctOption}" based on the core concept being tested.`;
};

const subjectOptions = ["All Subjects", "English", "Mathematics", "Physics", "Chemistry", "Biology"];
const mcqCountOptions = [5, 10, 15, 20];
const timeOptions = [
  { label: "No Timer", value: 0 },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "20 min", value: 20 },
  { label: "30 min", value: 30 },
];

const SUBJECT_PILLS: Record<string, string> = {
  English:     "bg-violet-100 text-violet-700 border-violet-200",
  Mathematics: "bg-cyan-100 text-cyan-700 border-cyan-200",
  Physics:     "bg-amber-100 text-amber-700 border-amber-200",
  Chemistry:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  Biology:     "bg-rose-100 text-rose-700 border-rose-200",
};

const Practice = () => {
  const [phase, setPhase] = useState<"config" | "quiz" | "result">("config");
  const [subject, setSubject] = useState("All Subjects");
  const [mcqCount, setMcqCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState<typeof allQuestions>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const startQuiz = () => {
    if (!apiClient.isAuthenticated()) { setAuthDialogOpen(true); return; }
    let pool = subject === "All Subjects" ? [...allQuestions] : allQuestions.filter(q => q.subject === subject);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const quizSelection = pool.slice(0, Math.min(mcqCount, pool.length));
    setQuestions(quizSelection);
    setAnswers(new Array(quizSelection.length).fill(null));
    setCurrentQ(0);
    setScore(0);
    setTimeUp(false);
    setTimeLeft(timeLimit * 60);
    setPhase("quiz");
  };

  const finishQuiz = useCallback(() => {
    let s = 0;
    answers.forEach((a, i) => { if (a === questions[i]?.correct) s++; });
    setScore(s);
    setPhase("result");
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

  return (
    <>
      <Navbar />
      <AuthRequiredDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        message="Please log in first to start a practice test."
      />

      {/* same bg as rest of app */}
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">

        {/* ambient blobs — identical to other pages */}
        <motion.div aria-hidden animate={{ x: [0, 22, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, -18, 0], y: [0, 16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, 10, 0], y: [0, -12, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-300/15 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 max-w-6xl">

          {/* ══════════ CONFIG ══════════ */}
          {phase === "config" && (
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>

              {/* hero — same violet gradient as all other pages */}
              <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-400/30">
                <motion.div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
                  animate={{ x: [0, 16, 0], y: [0, -14, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
                <motion.div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl"
                  animate={{ x: [0, -12, 0], y: [0, 12, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                    <Settings className="h-3.5 w-3.5" /> Practice Test
                  </span>
                  <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">Configure Your Test</h1>
                  <p className="mt-1.5 text-sm text-violet-200">Pick your subject, question count and time limit — then hit start.</p>
                  <div className="mt-5 flex gap-1.5">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
                    ))}
                  </div>
                </div>
              </div>

              {/* white config card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/30 space-y-8">

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Subject</label>
                  <div className="flex flex-wrap gap-2">
                    {subjectOptions.map(s => (
                      <button key={s} onClick={() => setSubject(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                          subject === s
                            ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Number of Questions</label>
                  <div className="grid grid-cols-4 gap-2 sm:max-w-xs">
                    {mcqCountOptions.map(n => (
                      <button key={n} onClick={() => setMcqCount(n)}
                        className={`py-3 rounded-xl text-sm font-bold transition-all duration-200 border ${
                          mcqCount === n
                            ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 block">Time Limit</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {timeOptions.map(t => (
                      <button key={t.value} onClick={() => setTimeLimit(t.value)}
                        className={`py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 border ${
                          timeLimit === t.value
                            ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* summary */}
                <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-violet-100 bg-violet-50/60 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-violet-400" />
                    <span className="font-semibold text-slate-700">{subject}</span>
                  </div>
                  <div className="h-4 w-px bg-violet-200" />
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-fuchsia-400" />
                    <span className="font-semibold text-slate-700">{mcqCount} MCQs</span>
                  </div>
                  <div className="h-4 w-px bg-violet-200" />
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-cyan-400" />
                    <span className="font-semibold text-slate-700">{timeLimit === 0 ? "Untimed" : `${timeLimit} min`}</span>
                  </div>
                </div>

                <button onClick={startQuiz}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-xl shadow-violet-300/40 transition-all duration-200 hover:from-violet-500 hover:to-fuchsia-500 hover:-translate-y-0.5 active:scale-[0.99]">
                  <Play className="h-5 w-5" /> Start Test
                </button>
              </div>
            </motion.div>
          )}

          {/* ══════════ QUIZ ══════════ */}
          {phase === "quiz" && q && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-6 items-start">

                <div>
                  {/* top bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <button onClick={restart}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-violet-300 hover:text-violet-700">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                      </button>
                      <button onClick={restart}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-100">
                        <LogOut className="h-3.5 w-3.5" /> Quit
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${SUBJECT_PILLS[q.subject] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {q.subject}
                      </span>
                      {timeLimit > 0 && (
                        <span className={`font-mono text-sm font-bold flex items-center gap-1.5 rounded-xl px-3 py-1.5 border ${
                          timeLeft < 60 ? "text-rose-600 bg-rose-50 border-rose-200" : "text-emerald-600 bg-emerald-50 border-emerald-200"
                        }`}>
                          <Clock className="h-3.5 w-3.5" /> {formatTime(timeLeft)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* progress */}
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Question {currentQ + 1} of {questions.length}</span>
                    <span>{Math.round(((currentQ + 1) / questions.length) * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 mb-6 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                      animate={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                      transition={{ duration: 0.3 }} />
                  </div>

                  {/* question card — white */}
                  <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/30 mb-5">
                    <p className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed mb-8">{q.question}</p>
                    <div className="space-y-3">
                      {q.options.map((opt, i) => {
                        const isSelected = selected === i;
                        return (
                          <motion.button key={i} whileHover={{ x: 3 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            onClick={() => handleSelect(i)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${
                              isSelected
                                ? "border-violet-400 bg-violet-50 shadow-md shadow-violet-100"
                                : "border-slate-100 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/50"
                            }`}>
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black border-2 transition-all ${
                              isSelected ? "border-violet-500 bg-violet-500 text-white" : "border-slate-200 bg-white text-slate-500"
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className={`text-sm sm:text-base font-semibold flex-1 ${isSelected ? "text-violet-900" : "text-slate-700"}`}>
                              {opt}
                            </span>
                            {isSelected && <CheckCircle2 className="h-5 w-5 text-violet-500 shrink-0" />}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* sidebar */}
                <aside className="lg:sticky lg:top-28 space-y-4">
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-violet-100/20">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800">Navigator</p>
                      <span className="text-xs text-slate-400">{answeredCount}/{questions.length}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {questions.map((_, index) => {
                        const isCurrent = index === currentQ;
                        const isAnswered = answers[index] !== null;
                        return (
                          <button key={index} onClick={() => jumpToQuestion(index)}
                            className={`h-9 rounded-lg text-xs font-bold transition-all ${
                              isCurrent
                                ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-200"
                                : isAnswered
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-violet-50 hover:border-violet-200"
                            }`}>
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gradient-to-br from-violet-500 to-fuchsia-500" />Current</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-200" />Done</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-200" />Skip</span>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-lg shadow-violet-100/20 space-y-2">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Actions</p>
                    <button onClick={prevQ} disabled={currentQ === 0}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                      <ArrowLeft className="h-4 w-4" /> Previous
                    </button>
                    {currentQ < questions.length - 1 ? (
                      <button onClick={nextQ}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-200 transition hover:from-violet-500 hover:to-fuchsia-500">
                        Next <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button onClick={finishQuiz}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-200 transition hover:from-emerald-400 hover:to-teal-400">
                        Submit <CheckCircle2 className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={finishQuiz}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-2.5 text-sm font-semibold text-amber-600 transition hover:bg-amber-100">
                      Finish Now
                    </button>
                  </div>
                </aside>
              </div>
            </motion.div>
          )}

          {/* ══════════ RESULT ══════════ */}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}>

              {timeUp && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800">Time's up! Your test has been auto-submitted.</p>
                </div>
              )}

              {/* score hero — same violet gradient */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 sm:p-12 text-center mb-6 shadow-2xl shadow-violet-400/30">
                <motion.div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
                  animate={{ x: [0, 16, 0], y: [0, -14, 0] }} transition={{ duration: 10, repeat: Infinity }} />
                <motion.div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl"
                  animate={{ x: [0, -12, 0], y: [0, 12, 0] }} transition={{ duration: 12, repeat: Infinity }} />
                <div className="relative z-10">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm shadow-xl mb-5">
                    <CheckCircle2 className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-1">Test Complete!</h2>
                  <p className="text-violet-200 text-sm mb-4">You scored {score} out of {questions.length}</p>
                  <div className="text-6xl sm:text-7xl font-black text-white drop-shadow-lg mb-8">{pct}%</div>

                  <div className="flex flex-wrap justify-center gap-3 mb-8">
                    {[
                      { label: "Correct", value: score },
                      { label: "Wrong",   value: answers.filter((a, i) => a !== null && a !== questions[i]?.correct).length },
                      { label: "Skipped", value: answers.filter(a => a === null).length },
                    ].map(stat => (
                      <div key={stat.label} className="rounded-2xl border border-white/20 bg-white/15 backdrop-blur-sm px-6 py-3">
                        <div className="text-2xl font-black text-white">{stat.value}</div>
                        <div className="text-xs text-violet-200 mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button onClick={restart}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/15 backdrop-blur-sm px-6 py-3 text-sm font-bold text-white transition hover:bg-white/25">
                      <Settings className="h-4 w-4" /> New Test
                    </button>
                    <button onClick={() => { setPhase("config"); startQuiz(); }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-violet-700 shadow-xl transition hover:bg-violet-50">
                      <RotateCcw className="h-4 w-4" /> Retry Same
                    </button>
                  </div>
                </div>
              </div>

              {/* answer review — white card */}
              <div className="rounded-3xl border border-slate-100 bg-white p-6 sm:p-8 shadow-lg shadow-violet-100/20">
                <h3 className="text-lg font-bold text-slate-900 mb-5">Answer Review</h3>
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const userAns = answers[i];
                    const isCorrect = userAns === q.correct;
                    const isSkipped = userAns === null;
                    const explanation = buildExplanation(q.options[q.correct], q.subject);
                    return (
                      <div key={i} className={`rounded-2xl border p-4 sm:p-5 ${
                        isCorrect ? "border-emerald-200 bg-emerald-50/60"
                        : isSkipped ? "border-slate-200 bg-slate-50"
                        : "border-rose-200 bg-rose-50/60"
                      }`}>
                        <div className="flex items-start gap-3">
                          {isCorrect
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            : <XCircle className={`h-4 w-4 mt-0.5 shrink-0 ${isSkipped ? "text-slate-400" : "text-rose-500"}`} />
                          }
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Q{i + 1}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${SUBJECT_PILLS[q.subject] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                {q.subject}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-slate-800 mb-2">{q.question}</p>
                            <p className="text-xs text-slate-500">
                              Your answer:{" "}
                              <span className={isCorrect ? "text-emerald-600 font-semibold" : isSkipped ? "text-slate-500" : "text-rose-600 font-semibold"}>
                                {userAns !== null ? q.options[userAns] : "Skipped"}
                              </span>
                              {!isCorrect && <> · Correct: <span className="text-emerald-600 font-semibold">{q.options[q.correct]}</span></>}
                            </p>
                            <div className="mt-2.5 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                              <span className="font-bold text-violet-600">Explanation: </span>{explanation}
                            </div>
                          </div>
                        </div>
                      </div>
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
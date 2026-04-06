import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Clock, ArrowRight, RotateCcw, Settings, Play, Target, BookOpen, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

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

const subjectOptions = ["All Subjects", "English", "Mathematics", "Physics", "Chemistry", "Biology"];
const mcqCountOptions = [5, 10, 15, 20];
const timeOptions = [
  { label: "No Timer", value: 0 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "20 minutes", value: 20 },
  { label: "30 minutes", value: 30 },
];

const Practice = () => {
  const [phase, setPhase] = useState<"config" | "quiz" | "result">("config");
  const [subject, setSubject] = useState("All Subjects");
  const [mcqCount, setMcqCount] = useState(10);
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState<typeof allQuestions>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeUp, setTimeUp] = useState(false);

  const startQuiz = () => {
    let pool = subject === "All Subjects" ? [...allQuestions] : allQuestions.filter(q => q.subject === subject);
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected = pool.slice(0, Math.min(mcqCount, pool.length));
    setQuestions(selected);
    setAnswers(new Array(selected.length).fill(null));
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
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

  // Timer
  useEffect(() => {
    if (phase !== "quiz" || timeLimit === 0) return;
    if (timeLeft <= 0) {
      setTimeUp(true);
      finishQuiz();
      return;
    }
    const t = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft, timeLimit, finishQuiz]);

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    setAnswered(true);
    const newAnswers = [...answers];
    newAnswers[currentQ] = i;
    setAnswers(newAnswers);
  };

  const nextQ = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    } else {
      let s = 0;
      const finalAnswers = [...answers];
      finalAnswers.forEach((a, i) => { if (a === questions[i]?.correct) s++; });
      setScore(s);
      setPhase("result");
    }
  };

  const restart = () => {
    setPhase("config");
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const q = questions[currentQ];
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-2xl">

          {/* CONFIG PHASE */}
          {phase === "config" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="font-heading text-3xl font-bold text-foreground mb-2">Configure Your Test</h1>
                <p className="text-muted-foreground">Customize your practice session below.</p>
              </div>

              <div className="bg-card rounded-xl p-6 shadow-card space-y-6">
                {/* Subject */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Subject</label>
                  <div className="flex flex-wrap gap-2">
                    {subjectOptions.map(s => (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          subject === s
                            ? "gradient-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MCQ Count */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Number of Questions</label>
                  <div className="flex gap-2">
                    {mcqCountOptions.map(n => (
                      <button
                        key={n}
                        onClick={() => setMcqCount(n)}
                        className={`flex-1 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                          mcqCount === n
                            ? "gradient-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-3 block">Time Limit</label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeOptions.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setTimeLimit(t.value)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          timeLimit === t.value
                            ? "gradient-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-secondary/50 rounded-lg p-4 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><BookOpen className="h-4 w-4" /> {subject}</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Target className="h-4 w-4" /> {mcqCount} MCQs</div>
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Clock className="h-4 w-4" /> {timeLimit === 0 ? "Untimed" : `${timeLimit} min`}</div>
                </div>

                <Button onClick={startQuiz} size="lg" className="w-full gradient-primary text-primary-foreground border-0 gap-2">
                  <Play className="h-5 w-5" /> Start Test
                </Button>
              </div>
            </motion.div>
          )}

          {/* QUIZ PHASE */}
          {phase === "quiz" && q && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} key={currentQ}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm text-muted-foreground">Question {currentQ + 1} of {questions.length}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{q.subject}</span>
                  {timeLimit > 0 && (
                    <span className={`text-sm font-mono font-semibold flex items-center gap-1 ${timeLeft < 60 ? "text-destructive" : "text-foreground"}`}>
                      <Clock className="h-4 w-4" /> {formatTime(timeLeft)}
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 bg-secondary rounded-full mb-8 overflow-hidden">
                <div className="h-full gradient-primary rounded-full transition-all" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
              </div>

              {/* Question */}
              <div className="bg-card rounded-xl p-6 shadow-card mb-6">
                <h2 className="font-heading text-xl font-semibold text-foreground mb-6">{q.question}</h2>
                <div className="space-y-3">
                  {q.options.map((opt, i) => {
                    let classes = "border-border bg-secondary/30 hover:bg-secondary";
                    if (answered && i === q.correct) classes = "border-success bg-success/10";
                    else if (answered && i === selected && i !== q.correct) classes = "border-destructive bg-destructive/10";
                    else if (selected === i) classes = "border-primary bg-primary/5";

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelect(i)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${classes} ${!answered ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full border-2 border-inherit flex items-center justify-center text-xs font-medium">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-sm font-medium text-foreground">{opt}</span>
                          {answered && i === q.correct && <CheckCircle2 className="h-5 w-5 text-success ml-auto" />}
                          {answered && i === selected && i !== q.correct && <XCircle className="h-5 w-5 text-destructive ml-auto" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {answered && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Button onClick={nextQ} className="w-full gradient-primary text-primary-foreground border-0 gap-2">
                    {currentQ < questions.length - 1 ? "Next Question" : "See Results"} <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* RESULT PHASE */}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              {timeUp && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 mb-6 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning flex-shrink-0" />
                  <p className="text-sm text-foreground">Time's up! Your test has been auto-submitted.</p>
                </div>
              )}

              <div className="bg-card rounded-2xl p-10 shadow-card text-center mb-6">
                <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10 text-primary-foreground" />
                </div>
                <h2 className="font-heading text-3xl font-bold text-foreground mb-2">Test Complete!</h2>
                <p className="text-muted-foreground mb-2">You scored {score} out of {questions.length}</p>
                <div className="text-5xl font-heading font-bold gradient-text mb-4">{pct}%</div>

                <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
                  <div className="bg-success/10 rounded-lg p-3">
                    <div className="font-bold text-success text-lg">{score}</div>
                    <div className="text-xs text-muted-foreground">Correct</div>
                  </div>
                  <div className="bg-destructive/10 rounded-lg p-3">
                    <div className="font-bold text-destructive text-lg">{answers.filter((a, i) => a !== null && a !== questions[i]?.correct).length}</div>
                    <div className="text-xs text-muted-foreground">Wrong</div>
                  </div>
                  <div className="bg-secondary rounded-lg p-3">
                    <div className="font-bold text-muted-foreground text-lg">{answers.filter(a => a === null).length}</div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button onClick={restart} variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" /> New Test
                  </Button>
                  <Button onClick={() => { setPhase("config"); startQuiz(); }} className="gradient-primary text-primary-foreground border-0 gap-2">
                    <RotateCcw className="h-4 w-4" /> Retry Same
                  </Button>
                </div>
              </div>

              {/* Review answers */}
              <div className="bg-card rounded-xl p-6 shadow-card">
                <h3 className="font-heading font-semibold text-foreground mb-4">Answer Review</h3>
                <div className="space-y-3">
                  {questions.map((q, i) => {
                    const userAns = answers[i];
                    const isCorrect = userAns === q.correct;
                    return (
                      <div key={i} className={`p-4 rounded-lg border ${isCorrect ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                        <div className="flex items-start gap-2">
                          {isCorrect ? <CheckCircle2 className="h-4 w-4 text-success mt-0.5 flex-shrink-0" /> : <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground mb-1">{q.question}</p>
                            <p className="text-xs text-muted-foreground">
                              Your answer: <span className={isCorrect ? "text-success" : "text-destructive"}>{userAns !== null ? q.options[userAns] : "Skipped"}</span>
                              {!isCorrect && <> · Correct: <span className="text-success">{q.options[q.correct]}</span></>}
                            </p>
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

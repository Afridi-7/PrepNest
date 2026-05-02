import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Clock3, Layers, Loader2, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject } from "@/services/api";

/* HAT Section breakdown — from official HAT specs */
const HAT_SECTIONS = [
  {
    label: "English / Verbal Reasoning",
    pct: "30%",
    cardBg: "bg-white/95 dark:bg-slate-900/90",
    border: "border-violet-300 dark:border-violet-500/20",
    bar: "from-violet-500 to-purple-500",
    pctColor: "text-violet-700 dark:text-violet-200",
    labelColor: "text-violet-500 dark:text-violet-300",
  },
  {
    label: "Analytical Reasoning",
    pct: "30%",
    cardBg: "bg-white/95 dark:bg-slate-900/90",
    border: "border-fuchsia-300 dark:border-fuchsia-500/20",
    bar: "from-fuchsia-500 to-pink-500",
    pctColor: "text-fuchsia-700 dark:text-fuchsia-200",
    labelColor: "text-fuchsia-500 dark:text-fuchsia-300",
  },
  {
    label: "Quantitative Reasoning",
    pct: "40%",
    cardBg: "bg-white/95 dark:bg-slate-900/90",
    border: "border-indigo-300 dark:border-indigo-500/20",
    bar: "from-indigo-500 to-violet-500",
    pctColor: "text-indigo-700 dark:text-indigo-200",
    labelColor: "text-indigo-500 dark:text-indigo-300",
  },
];

/* Per-subject accent colours */
const SUBJECT_STYLES: Record<string, {
  gradient: string; border: string; code: string; bar: string; hover: string; iconBg: string;
}> = {
  default: {
    gradient: "from-violet-100 to-purple-200 dark:from-violet-500/20 dark:to-purple-500/10",
    border: "border-violet-300 dark:border-violet-500/20",
    code: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    bar: "from-violet-500 to-purple-600",
    hover: "hover:border-violet-400 hover:shadow-violet-200/60 dark:hover:border-violet-500/40 dark:hover:shadow-violet-950/20",
    iconBg: "bg-violet-500",
  },
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const HAT = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    apiClient
      .listUSATCategorySubjects("HAT")
      .then(setSubjects)
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-background pt-24 pb-20">
        <div className="container relative z-10 mx-auto px-4">

          {/* ── HERO ─────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 p-8 shadow-xl shadow-violet-400/20 md:p-10"
          >
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" /> HAT Premium Preparation Space
                </span>

                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-5xl">
                  HAT Exam
                  <br />
                  <span className="text-fuchsia-200">Preparation Hub</span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-relaxed text-violet-200 md:text-base">
                  Higher Aptitude Test preparation. Select a subject below to explore chapters, past papers, tips, and practice MCQs.
                </p>

                <div className="mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                  {["Subject", "Chapters & Materials", "Practice & Mock"].map((step, i, arr) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white/20 px-2 py-0.5">{step}</span>
                      {i < arr.length - 1 && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats card */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  Format: <span className="text-fuchsia-200">Aptitude + Subject</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Target className="h-4 w-4" />
                  </span>
                  Subjects: <span className="text-fuchsia-200">{loading ? "..." : subjects.length}</span>
                </div>
              </div>
            </div>

            {/* Section breakdown cards */}
            <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-3">
              {HAT_SECTIONS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                  className={`overflow-hidden rounded-2xl border p-4 shadow-sm ${item.cardBg} ${item.border}`}
                >
                  <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${item.bar}`} />
                  <p className={`text-xs font-medium ${item.labelColor}`}>{item.label}</p>
                  <p className={`mt-0.5 text-xl font-black ${item.pctColor}`}>{item.pct}</p>
                </motion.div>
              ))}
            </div>

            {/* Decorative dots */}
            <div className="mt-5 flex gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
              ))}
            </div>
          </motion.section>

          {/* ── SUBJECTS GRID ─────────────────────────────────────────── */}
          <section>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20">
                <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-foreground">HAT Subjects</h2>
                <p className="text-xs text-muted-foreground">Choose a subject to open chapters, notes, and MCQs</p>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                <p className="mt-3 text-sm text-muted-foreground">Loading subjects…</p>
              </div>
            ) : subjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 py-16 text-center dark:border-violet-700/30 dark:bg-violet-950/20">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-500/20">
                  <Layers className="h-7 w-7 text-violet-400" />
                </div>
                <p className="text-base font-semibold text-slate-600 dark:text-slate-300">No subjects yet</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">HAT subjects are being added. Check back soon.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subject, idx) => {
                  const style = SUBJECT_STYLES.default;
                  const slug = subject.slug ?? slugify(subject.name);
                  return (
                    <motion.button
                      key={subject.id}
                      onClick={() => navigate(`/hat/${encodeURIComponent(slug)}`)}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + idx * 0.04, duration: 0.35, ease: "easeOut" }}
                      className={`group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${style.gradient} ${style.border} ${style.hover}`}
                    >
                      {/* Top-right icon */}
                      <div className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${style.iconBg}`}>
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>

                      {/* Subject code badge */}
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${style.code}`}>
                        {subject.exam_type ?? "HAT"}
                      </span>

                      <div className="pr-12">
                        <h3 className="text-base font-extrabold text-slate-800 leading-snug dark:text-slate-100">
                          {subject.name}
                        </h3>
                        {subject.description && (
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                            {subject.description}
                          </p>
                        )}
                      </div>

                      {/* Progress bar accent */}
                      <div className={`h-1 w-full rounded-full bg-gradient-to-r ${style.bar} opacity-70`} />

                      {/* CTA */}
                      <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 group-hover:gap-2 transition-all">
                        Open Chapters <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default HAT;

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ChevronRight, Clock3, Layers, Loader2, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject } from "@/services/api";
import { useQuery } from "@tanstack/react-query";

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

/* Per-subject accent colours — keyed by lowercase keywords in subject name */
const SUBJECT_STYLES: Record<string, {
  gradient: string; border: string; code: string; bar: string; hover: string;
}> = {
  verbal: {
    gradient: "from-violet-100 to-purple-200 dark:from-violet-500/20 dark:to-purple-500/10",
    border: "border-violet-300 dark:border-violet-500/20",
    code: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    bar: "from-violet-500 to-purple-600",
    hover: "hover:border-violet-400 hover:shadow-violet-200/60 dark:hover:border-violet-500/40",
  },
  english: {
    gradient: "from-violet-100 to-purple-200 dark:from-violet-500/20 dark:to-purple-500/10",
    border: "border-violet-300 dark:border-violet-500/20",
    code: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    bar: "from-violet-500 to-purple-600",
    hover: "hover:border-violet-400 hover:shadow-violet-200/60 dark:hover:border-violet-500/40",
  },
  analytical: {
    gradient: "from-fuchsia-100 to-pink-200 dark:from-fuchsia-500/20 dark:to-pink-500/10",
    border: "border-fuchsia-300 dark:border-fuchsia-500/20",
    code: "bg-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
    bar: "from-fuchsia-500 to-pink-600",
    hover: "hover:border-fuchsia-400 hover:shadow-fuchsia-200/60 dark:hover:border-fuchsia-500/40",
  },
  quantitative: {
    gradient: "from-indigo-100 to-blue-200 dark:from-indigo-500/20 dark:to-blue-500/10",
    border: "border-indigo-300 dark:border-indigo-500/20",
    code: "bg-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
    bar: "from-indigo-500 to-blue-600",
    hover: "hover:border-indigo-400 hover:shadow-indigo-200/60 dark:hover:border-indigo-500/40",
  },
  default: {
    gradient: "from-violet-100 to-purple-200 dark:from-violet-500/20 dark:to-purple-500/10",
    border: "border-violet-300 dark:border-violet-500/20",
    code: "bg-violet-200 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
    bar: "from-violet-500 to-purple-600",
    hover: "hover:border-violet-400 hover:shadow-violet-200/60 dark:hover:border-violet-500/40",
  },
};

const getSubjectStyle = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("quantitative")) return SUBJECT_STYLES.quantitative;
  if (lower.includes("analytical"))   return SUBJECT_STYLES.analytical;
  if (lower.includes("english") || lower.includes("verbal")) return SUBJECT_STYLES.english;
  return SUBJECT_STYLES.default;
};

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const HAT = () => {
  const navigate = useNavigate();

  // Cached — identical query key is shared if this component is mounted
  // multiple times; data is instantly available on back-navigation.
  const { data: subjects = [], isLoading: loading } = useQuery<Subject[]>({
    queryKey: ["hat-subjects"],
    queryFn: () => apiClient.listUSATCategorySubjects("HAT"),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });

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
                  const style = getSubjectStyle(subject.name);
                  const slug = subject.slug ?? slugify(subject.name);
                  return (
                    <motion.button
                      key={subject.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06, duration: 0.42, ease: "easeOut" }}
                      whileHover={{ y: -4, boxShadow: "0 16px 48px -12px rgba(0,0,0,0.12), 0 6px 16px -4px rgba(0,0,0,0.06)", transition: { duration: 0 } }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/hat/${encodeURIComponent(slug)}`)}
                      className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-5 text-left shadow-lg transition-shadow duration-300 ${style.gradient} ${style.border} ${style.hover} hover:shadow-xl`}
                    >
                      {/* Top gradient bar */}
                      <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${style.bar}`} />

                      <div className="flex items-start justify-between">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${style.code}`}>
                          HAT
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/70 transition-transform duration-200 group-hover:translate-x-0.5 dark:border-slate-700 dark:bg-slate-900/70">
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-extrabold leading-snug text-slate-900 dark:text-slate-100">
                        {subject.name}
                      </h3>
                      {subject.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                          {subject.description}
                        </p>
                      )}

                      <div className="mt-4 flex items-center gap-1 text-xs font-bold text-slate-500 transition-all duration-200 group-hover:gap-2 group-hover:text-slate-700 dark:text-slate-300 dark:group-hover:text-slate-100">
                        Open Chapters
                        <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                      </div>
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

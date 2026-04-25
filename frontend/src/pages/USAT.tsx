import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Clock3, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, USATCategory } from "@/services/api";

const CATEGORY_CARD_STYLES: Record<string, {
  gradient: string; border: string; code: string; bar: string; hover: string; iconBg: string;
}> = {
  "USAT-E": { gradient: "from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-500/10", border: "border-blue-300 dark:border-blue-500/20", code: "bg-blue-200 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200", bar: "from-blue-500 to-blue-600", hover: "hover:border-blue-400 hover:shadow-blue-200/60 dark:hover:border-blue-500/40 dark:hover:shadow-blue-950/20", iconBg: "bg-blue-500" },
  "USAT-M": { gradient: "from-emerald-100 to-teal-200 dark:from-emerald-500/20 dark:to-teal-500/10", border: "border-emerald-300 dark:border-emerald-500/20", code: "bg-emerald-200 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200", bar: "from-emerald-500 to-teal-600", hover: "hover:border-emerald-400 hover:shadow-emerald-200/60 dark:hover:border-emerald-500/40 dark:hover:shadow-emerald-950/20", iconBg: "bg-emerald-500" },
  "USAT-CS": { gradient: "from-cyan-100 to-sky-200 dark:from-cyan-500/20 dark:to-sky-500/10", border: "border-cyan-300 dark:border-cyan-500/20", code: "bg-cyan-200 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200", bar: "from-cyan-500 to-sky-600", hover: "hover:border-cyan-400 hover:shadow-cyan-200/60 dark:hover:border-cyan-500/40 dark:hover:shadow-cyan-950/20", iconBg: "bg-cyan-500" },
  "USAT-GS": { gradient: "from-amber-100 to-orange-200 dark:from-amber-500/20 dark:to-orange-500/10", border: "border-amber-300 dark:border-amber-500/20", code: "bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200", bar: "from-amber-500 to-orange-600", hover: "hover:border-amber-400 hover:shadow-amber-200/60 dark:hover:border-amber-500/40 dark:hover:shadow-amber-950/20", iconBg: "bg-amber-500" },
  "USAT-A": { gradient: "from-rose-100 to-pink-200 dark:from-rose-500/20 dark:to-pink-500/10", border: "border-rose-300 dark:border-rose-500/20", code: "bg-rose-200 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200", bar: "from-rose-500 to-pink-600", hover: "hover:border-rose-400 hover:shadow-rose-200/60 dark:hover:border-rose-500/40 dark:hover:shadow-rose-950/20", iconBg: "bg-rose-500" },
  "USAT-COM": { gradient: "from-teal-100 to-emerald-200 dark:from-teal-500/20 dark:to-emerald-500/10", border: "border-teal-300 dark:border-teal-500/20", code: "bg-teal-200 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200", bar: "from-teal-500 to-emerald-600", hover: "hover:border-teal-400 hover:shadow-teal-200/60 dark:hover:border-teal-500/40 dark:hover:shadow-teal-950/20", iconBg: "bg-teal-500" },
};

const FALLBACK_STYLE = {
  gradient: "from-indigo-100 to-blue-200 dark:from-indigo-500/20 dark:to-blue-500/10",
  border: "border-indigo-300 dark:border-indigo-500/20",
  code: "bg-indigo-200 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  bar: "from-indigo-500 to-blue-600",
  hover: "hover:border-indigo-400 hover:shadow-indigo-200/60 dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-950/20",
  iconBg: "bg-indigo-500",
};

const examInfo = [
  { label: "Verbal Reasoning", marks: "20", cardBg: "bg-white/95 dark:bg-slate-900/90", border: "border-blue-300 dark:border-blue-500/20", bar: "from-blue-500 to-blue-500", marksColor: "text-blue-700 dark:text-blue-200", labelColor: "text-blue-500 dark:text-blue-300" },
  { label: "Quantitative Reasoning", marks: "25", cardBg: "bg-white/95 dark:bg-slate-900/90", border: "border-cyan-300 dark:border-cyan-500/20", bar: "from-cyan-500 to-sky-500", marksColor: "text-cyan-700 dark:text-cyan-200", labelColor: "text-cyan-500 dark:text-cyan-300" },
  { label: "Subject Knowledge", marks: "30", cardBg: "bg-white/95 dark:bg-slate-900/90", border: "border-emerald-300 dark:border-emerald-500/20", bar: "from-emerald-500 to-teal-500", marksColor: "text-emerald-700 dark:text-emerald-200", labelColor: "text-emerald-500 dark:text-emerald-300" },
  { label: "Essay Writing", marks: "25", cardBg: "bg-white/95 dark:bg-slate-900/90", border: "border-amber-300 dark:border-amber-500/20", bar: "from-amber-500 to-orange-500", marksColor: "text-amber-700 dark:text-amber-200", labelColor: "text-amber-500 dark:text-amber-300" },
];

const USAT = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      setLoading(true);
      const fetchedCategories = await apiClient.listUSATCategories();
      setCategories(fetchedCategories);
    })()
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />

      <div className="relative min-h-screen overflow-hidden bg-background pt-24 pb-20">

        <div className="container relative z-10 mx-auto px-4">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-8 shadow-xl shadow-blue-400/20 md:p-10"
          >

            <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" /> USAT Premium Preparation Space
                </span>

                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-5xl">
                  Choose Your
                  <br />
                  <span className="text-cyan-200">USAT Stream</span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-relaxed text-blue-200 md:text-base">
                  Start with a category. A dedicated subjects window opens next. Then open a subject to enter chapters and resources.
                </p>

                <div className="mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-blue-100 backdrop-blur-sm">
                  {["Category", "Subject", "Chapters & Materials"].map((step, i, arr) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white/20 px-2 py-0.5">{step}</span>
                      {i < arr.length - 1 && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  Total Time: <span className="text-cyan-200">140 minutes</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Target className="h-4 w-4" />
                  </span>
                  Passing Marks: <span className="text-cyan-200">50</span>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {examInfo.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                  className={`overflow-hidden rounded-2xl border p-4 shadow-sm ${item.cardBg} ${item.border}`}
                >
                  <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${item.bar}`} />
                  <p className={`text-xs font-medium ${item.labelColor}`}>{item.label}</p>
                  <p className={`mt-1 text-3xl font-black ${item.marksColor}`}>{item.marks}</p>
                  <p className="text-[11px] text-slate-400">marks</p>
                </motion.div>
              ))}
            </div>

            <div className="relative z-10 mt-6 flex gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 28 : 8 }} />
              ))}
            </div>
          </motion.section>

          <section>
            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">USAT Categories</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-blue-200 to-transparent dark:from-blue-500/20" />
              {!loading && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-600 dark:bg-blue-500/15 dark:text-blue-200">
                  {categories.length} streams
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/70 shadow-sm dark:bg-slate-800/70" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category, index) => {
                  const style = CATEGORY_CARD_STYLES[category.code] || FALLBACK_STYLE;
                  return (
                    <motion.button
                      key={category.code}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06, duration: 0.42, ease: "easeOut" }}
                      whileHover={{ y: -4, boxShadow: "0 16px 48px -12px rgba(0,0,0,0.12), 0 6px 16px -4px rgba(0,0,0,0.06)", transition: { duration: 0 } }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/usat/${encodeURIComponent(category.code)}`)}
                      className={`group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-5 text-left shadow-lg transition-shadow duration-300 ${style.gradient} ${style.border} ${style.hover} hover:shadow-xl`}
                    >
                      <div className={`absolute top-0 left-0 h-1.5 w-full bg-gradient-to-r ${style.bar}`} />

                      <div className="flex items-start justify-between">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${style.code}`}>
                          {category.code}
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/70 transition-transform duration-200 group-hover:translate-x-0.5 dark:border-slate-700 dark:bg-slate-900/70">
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-extrabold leading-snug text-slate-900 dark:text-slate-100">
                        {category.title}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {category.description}
                      </p>

                      <div className="mt-4 flex items-center gap-1 text-xs font-bold text-slate-500 transition-all duration-200 group-hover:gap-2 group-hover:text-slate-700 dark:text-slate-300 dark:group-hover:text-slate-100">
                        Open subjects window
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

export default USAT;

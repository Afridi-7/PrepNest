import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Clock3, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, USATCategory } from "@/services/api";

const CATEGORY_CARD_STYLES: Record<string, {
  gradient: string; border: string; code: string; bar: string; hover: string;
}> = {
  "USAT-E":  { gradient: "from-violet-50 to-purple-100",  border: "border-violet-200",  code: "bg-violet-100 text-violet-700",  bar: "from-violet-400 to-purple-500",  hover: "hover:border-violet-300 hover:shadow-violet-100" },
  "USAT-M":  { gradient: "from-emerald-50 to-teal-100",   border: "border-emerald-200", code: "bg-emerald-100 text-emerald-700", bar: "from-emerald-400 to-teal-500",   hover: "hover:border-emerald-300 hover:shadow-emerald-100" },
  "USAT-CS": { gradient: "from-cyan-50 to-sky-100",       border: "border-cyan-200",    code: "bg-cyan-100 text-cyan-700",     bar: "from-cyan-400 to-sky-500",      hover: "hover:border-cyan-300 hover:shadow-cyan-100" },
  "USAT-GS": { gradient: "from-amber-50 to-orange-100",   border: "border-amber-200",   code: "bg-amber-100 text-amber-700",   bar: "from-amber-400 to-orange-500",   hover: "hover:border-amber-300 hover:shadow-amber-100" },
  "USAT-A":  { gradient: "from-rose-50 to-pink-100",      border: "border-rose-200",    code: "bg-rose-100 text-rose-700",     bar: "from-rose-400 to-pink-500",      hover: "hover:border-rose-300 hover:shadow-rose-100" },
};

const FALLBACK_STYLE = {
  gradient: "from-indigo-50 to-blue-100", border: "border-indigo-200",
  code: "bg-indigo-100 text-indigo-700",  bar: "from-indigo-400 to-blue-500",
  hover: "hover:border-indigo-300 hover:shadow-indigo-100",
};

const examInfo = [
  { label: "Verbal Reasoning",       marks: "20", cardBg: "bg-white/95", border: "border-violet-200", bar: "from-violet-400 to-purple-400", marksColor: "text-violet-600", labelColor: "text-violet-400" },
  { label: "Quantitative Reasoning", marks: "25", cardBg: "bg-white/95", border: "border-cyan-200",   bar: "from-cyan-400 to-sky-400",     marksColor: "text-cyan-600",   labelColor: "text-cyan-400" },
  { label: "Subject Knowledge",      marks: "30", cardBg: "bg-white/95", border: "border-emerald-200",bar: "from-emerald-400 to-teal-400", marksColor: "text-emerald-600",labelColor: "text-emerald-400" },
  { label: "Essay Writing",          marks: "25", cardBg: "bg-white/95", border: "border-amber-200",  bar: "from-amber-400 to-orange-400", marksColor: "text-amber-600",  labelColor: "text-amber-400" },
];

const USAT = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
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

      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">

        {/* ── ambient blobs ── */}
        <motion.div aria-hidden animate={{ x: [0, 22, 0], y: [0, -18, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, -18, 0], y: [0, 16, 0] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <motion.div aria-hidden animate={{ x: [0, 10, 0], y: [0, -12, 0] }} transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-300/15 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4">

          {/* ── HERO HEADER ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-400/30 md:p-10"
          >
            {/* inner glow orbs */}
            <motion.div aria-hidden className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              animate={{ x: [0, 18, 0], y: [0, -16, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div aria-hidden className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-2xl"
              animate={{ x: [0, -14, 0], y: [0, 14, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />

            <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">

              {/* left copy */}
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" /> USAT Premium Preparation Space
                </span>

                <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm md:text-5xl">
                  Choose Your<br />
                  <span className="text-fuchsia-200">USAT Stream</span>
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-relaxed text-violet-200 md:text-base">
                  Start with a category. A dedicated subjects window opens next. Then open a subject to enter chapters and resources.
                </p>

                {/* flow breadcrumb */}
                <div className="mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
                  {["Category", "Subject", "Chapters & Materials"].map((step, i, arr) => (
                    <span key={step} className="flex items-center gap-1.5">
                      <span className="rounded-full bg-white/20 px-2 py-0.5">{step}</span>
                      {i < arr.length - 1 && <ChevronRight className="h-3 w-3 opacity-60" />}
                    </span>
                  ))}
                </div>
              </div>

              {/* right stats chip */}
              <div className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  Total Time: <span className="text-fuchsia-200">140 minutes</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm font-semibold text-white">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
                    <Target className="h-4 w-4" />
                  </span>
                  Passing Marks: <span className="text-fuchsia-200">50</span>
                </div>
              </div>
            </div>

            {/* ── EXAM INFO CARDS ── */}
            <div className="relative z-10 mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {examInfo.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                  className={`overflow-hidden rounded-2xl border p-4 shadow-sm ${item.cardBg} ${item.border}`}
                >
                  {/* top mini bar */}
                  <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${item.bar}`} />
                  <p className={`text-xs font-medium ${item.labelColor}`}>{item.label}</p>
                  <p className={`mt-1 text-3xl font-black ${item.marksColor}`}>{item.marks}</p>
                  <p className="text-[11px] text-slate-400">marks</p>
                </motion.div>
              ))}
            </div>

            {/* decorative dots */}
            <div className="relative z-10 mt-6 flex gap-1.5">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 28 : 8 }} />
              ))}
            </div>
          </motion.section>

          {/* ── CATEGORIES SECTION ── */}
          <section>
            <div className="mb-5 flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800">USAT Categories</h2>
              <div className="h-px flex-1 bg-gradient-to-r from-violet-200 to-transparent" />
              {!loading && (
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-600">
                  {categories.length} streams
                </span>
              )}
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-40 animate-pulse rounded-2xl bg-white/70 shadow-sm"
                    style={{ animationDelay: `${i * 80}ms` }} />
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
                      whileHover={{ y: -5, transition: { type: "spring", stiffness: 320, damping: 22 } }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => navigate(`/usat/${encodeURIComponent(category.code)}`)}
                      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-md transition-shadow duration-300 ${style.gradient} ${style.border} ${style.hover} hover:shadow-xl`}
                    >
                      {/* top accent bar */}
                      <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${style.bar}`} />

                      {/* top row: code badge + arrow */}
                      <div className="flex items-start justify-between">
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${style.code}`}>
                          {category.code}
                        </span>
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/70 transition-transform duration-200 group-hover:translate-x-0.5">
                          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                        </span>
                      </div>

                      {/* text */}
                      <h3 className="mt-3 text-lg font-extrabold leading-snug text-slate-900">
                        {category.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 line-clamp-2">
                        {category.description}
                      </p>

                      {/* cta */}
                      <div className="mt-4 flex items-center gap-1 text-xs font-bold text-slate-500 transition-all duration-200 group-hover:gap-2 group-hover:text-slate-700">
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
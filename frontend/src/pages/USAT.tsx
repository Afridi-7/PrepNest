import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock3, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, USATCategory } from "@/services/api";

const CATEGORY_CARD_STYLES: Record<string, string> = {
  "USAT-E": "from-cyan-200 via-sky-300 to-blue-500 border-cyan-400",
  "USAT-M": "from-emerald-200 via-lime-300 to-green-500 border-emerald-400",
  "USAT-CS": "from-blue-200 via-cyan-300 to-teal-500 border-blue-400",
  "USAT-GS": "from-amber-200 via-yellow-300 to-orange-500 border-amber-400",
  "USAT-A": "from-rose-200 via-orange-300 to-amber-500 border-rose-400",
};

const examInfo = [
  { label: "Verbal Reasoning", marks: "20" },
  { label: "Quantitative Reasoning", marks: "25" },
  { label: "Subject Knowledge", marks: "30" },
  { label: "Essay Writing", marks: "25" },
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
      <div className="relative min-h-screen overflow-hidden bg-white pt-24 pb-16">
        <motion.div
          aria-hidden
          animate={{ x: [0, 20, 0], y: [0, -16, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -18, 0], y: [0, 14, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 10, 0], y: [0, -12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-blue-300/15 blur-3xl"
        />

        <div className="container relative z-10 mx-auto px-4">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mb-8 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50 to-cyan-100/80 p-6 shadow-xl ring-1 ring-cyan-100/70 md:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-1 rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                  <Sparkles className="h-3.5 w-3.5" /> USAT Premium Preparation Space
                </p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Choose Your USAT Stream</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                  Start with a category. A dedicated subjects window opens next. Then open a subject to enter chapters and resources.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                <p className="inline-flex items-center gap-2 font-semibold text-slate-800"><Clock3 className="h-4 w-4 text-cyan-700" /> Total Time: 140 minutes</p>
                <p className="mt-1 inline-flex items-center gap-2 font-semibold text-slate-800"><Target className="h-4 w-4 text-emerald-700" /> Passing Marks: 50</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {examInfo.map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900">{item.marks}</p>
                  <p className="text-xs text-slate-500">Marks</p>
                </div>
              ))}
            </div>
          </motion.section>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-slate-900">USAT Categories</h2>
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category, index) => (
                  <motion.button
                    key={category.code}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.42, ease: "easeOut" }}
                    onClick={() => navigate(`/usat/${encodeURIComponent(category.code)}`)}
                    className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left text-slate-900 shadow-lg ring-1 ring-white/30 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl ${
                      CATEGORY_CARD_STYLES[category.code] || "from-cyan-300 via-sky-300 to-blue-400 border-cyan-400"
                    }`}
                  >
                    <div className="pointer-events-none absolute -right-12 -top-12 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
                    <div className="inline-flex rounded-md border border-white/50 bg-white/35 px-2 py-1 text-xs font-bold text-slate-900">{category.code}</div>
                    <h3 className="mt-3 text-lg font-extrabold">{category.title}</h3>
                    <p className="mt-1 text-sm text-slate-800/90">{category.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-900/80">Open Subjects Window</p>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default USAT;

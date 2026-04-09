import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject } from "@/services/api";

const SUBJECT_STYLES = [
  "from-cyan-100 via-sky-200 to-blue-200 border-cyan-200",
  "from-emerald-100 via-lime-200 to-green-200 border-emerald-200",
  "from-blue-100 via-cyan-200 to-teal-200 border-blue-200",
  "from-amber-100 via-yellow-200 to-orange-200 border-amber-200",
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const USATSubjects = () => {
  const navigate = useNavigate();
  const { category = "" } = useParams();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    (async () => {
      if (!category) return;
      setLoading(true);
      const fetched = await apiClient.listUSATCategorySubjects(category);
      setSubjects(fetched);
    })()
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-white pt-24 pb-16">
        <motion.div
          aria-hidden
          animate={{ x: [0, 18, 0], y: [0, -14, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-24 -top-16 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -16, 0], y: [0, 12, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
        />

        <div className="container relative z-10 mx-auto px-4">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50 to-cyan-100/80 p-6 shadow-xl ring-1 ring-cyan-100/70"
          >
            <Link to="/usat" className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Categories
            </Link>
            <p className="mt-3 inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
              <Sparkles className="h-3.5 w-3.5" /> Subjects Window
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{category} Subjects</h1>
            <p className="mt-1 text-sm text-slate-600">Select a subject to open its chapter window.</p>
          </motion.section>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          ) : subjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No subjects available for this category yet.</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject, index) => (
                <motion.button
                  key={subject.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.42, ease: "easeOut" }}
                  onClick={() => navigate(`/usat/${encodeURIComponent(category)}/${slugify(subject.name)}`)}
                  className={`rounded-2xl border bg-gradient-to-br p-5 text-left shadow-md ring-1 ring-white/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    SUBJECT_STYLES[index % SUBJECT_STYLES.length]
                  }`}
                >
                  <div className="inline-flex rounded-xl bg-white/80 p-2 shadow-sm">
                    <BookOpen className="h-5 w-5 text-slate-800" />
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{subject.name}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-700">Open Chapters</p>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default USATSubjects;

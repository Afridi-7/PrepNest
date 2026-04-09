import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ChevronRight, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject } from "@/services/api";

/* ── per-card accent palette: soft but distinct, not retina-burning ── */
const CARD_STYLES = [
  {
    gradient: "from-violet-50 to-purple-100",
    border: "border-violet-200",
    icon: "bg-violet-100 text-violet-600",
    label: "text-violet-500",
    pill: "bg-violet-100 text-violet-700",
    bar: "bg-gradient-to-r from-violet-400 to-purple-400",
    hover: "hover:border-violet-300 hover:shadow-violet-100",
  },
  {
    gradient: "from-cyan-50 to-sky-100",
    border: "border-cyan-200",
    icon: "bg-cyan-100 text-cyan-600",
    label: "text-cyan-500",
    pill: "bg-cyan-100 text-cyan-700",
    bar: "bg-gradient-to-r from-cyan-400 to-sky-400",
    hover: "hover:border-cyan-300 hover:shadow-cyan-100",
  },
  {
    gradient: "from-emerald-50 to-teal-100",
    border: "border-emerald-200",
    icon: "bg-emerald-100 text-emerald-600",
    label: "text-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
    bar: "bg-gradient-to-r from-emerald-400 to-teal-400",
    hover: "hover:border-emerald-300 hover:shadow-emerald-100",
  },
  {
    gradient: "from-amber-50 to-orange-100",
    border: "border-amber-200",
    icon: "bg-amber-100 text-amber-600",
    label: "text-amber-500",
    pill: "bg-amber-100 text-amber-700",
    bar: "bg-gradient-to-r from-amber-400 to-orange-400",
    hover: "hover:border-amber-300 hover:shadow-amber-100",
  },
  {
    gradient: "from-rose-50 to-pink-100",
    border: "border-rose-200",
    icon: "bg-rose-100 text-rose-600",
    label: "text-rose-500",
    pill: "bg-rose-100 text-rose-700",
    bar: "bg-gradient-to-r from-rose-400 to-pink-400",
    hover: "hover:border-rose-300 hover:shadow-rose-100",
  },
  {
    gradient: "from-indigo-50 to-blue-100",
    border: "border-indigo-200",
    icon: "bg-indigo-100 text-indigo-600",
    label: "text-indigo-500",
    pill: "bg-indigo-100 text-indigo-700",
    bar: "bg-gradient-to-r from-indigo-400 to-blue-400",
    hover: "hover:border-indigo-300 hover:shadow-indigo-100",
  },
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

      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">

        {/* ── ambient background blobs ── */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 24, 0], y: [0, -18, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 -top-16 h-96 w-96 rounded-full bg-violet-300/20 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -18, 0], y: [0, 16, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-24 top-32 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 10, 0], y: [0, -12, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-300/15 blur-3xl"
        />

        <div className="container relative z-10 mx-auto px-4">

          {/* ── HERO HEADER ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative mb-10 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-400/30"
          >
            {/* inner glow orbs */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl"
              animate={{ x: [0, 16, 0], y: [0, -16, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-fuchsia-300/20 blur-2xl"
              animate={{ x: [0, -14, 0], y: [0, 14, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* back link */}
            <Link
              to="/usat"
              className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Categories
            </Link>

            {/* badge */}
            <div className="relative z-10 mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-violet-100 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" /> Subjects Window
            </div>

            <h1 className="relative z-10 mt-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {category}
            </h1>
            <p className="relative z-10 mt-1.5 text-sm text-violet-200">
              {subjects.length > 0
                ? `${subjects.length} subject${subjects.length !== 1 ? "s" : ""} available — pick one to explore its chapters.`
                : "Select a subject to open its chapter window."}
            </p>

            {/* decorative dots row */}
            <div className="relative z-10 mt-6 flex gap-1.5">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full bg-white/30"
                  style={{ width: i === 0 ? 24 : 8 }}
                />
              ))}
            </div>
          </motion.section>

          {/* ── LOADING SKELETONS ── */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl bg-white/70 shadow-sm"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>

          ) : subjects.length === 0 ? (
            /* ── EMPTY STATE ── */
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-200 bg-white/60 py-20 text-center backdrop-blur-sm"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100">
                <BookOpen className="h-7 w-7 text-violet-400" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-700">No subjects yet</p>
              <p className="mt-1 text-sm text-slate-400">Check back soon — content is being added.</p>
            </motion.div>

          ) : (
            /* ── SUBJECT CARDS GRID ── */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject, index) => {
                const style = CARD_STYLES[index % CARD_STYLES.length];
                return (
                  <motion.button
                    key={subject.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.055, duration: 0.4, ease: "easeOut" }}
                    whileHover={{ y: -4, transition: { type: "spring", stiffness: 320, damping: 22 } }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      navigate(`/usat/${encodeURIComponent(category)}/${slugify(subject.name)}`)
                    }
                    className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-md transition-shadow duration-300 ${style.gradient} ${style.border} ${style.hover} hover:shadow-xl`}
                  >
                    {/* top accent bar */}
                    <div className={`absolute top-0 left-0 h-1 w-full ${style.bar}`} />

                    {/* card number badge */}
                    <div className="absolute top-4 right-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${style.pill}`}>
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* icon */}
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${style.icon}`}>
                      <BookOpen className="h-5 w-5" />
                    </div>

                    {/* text */}
                    <h3 className="mt-3 pr-10 text-base font-bold leading-snug text-slate-900">
                      {subject.name}
                    </h3>

                    {/* cta row */}
                    <div className={`mt-3 flex items-center gap-1 text-xs font-semibold ${style.label} transition-all duration-200 group-hover:gap-2`}>
                      Open chapters
                      <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default USATSubjects;
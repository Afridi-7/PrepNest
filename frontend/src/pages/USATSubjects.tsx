import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ChevronRight, Plus, Sparkles, Trash2, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject } from "@/services/api";

/* ── per-card accent palette: vivid & bold for maximum visibility ── */
const CARD_STYLES = [
  {
    gradient: "from-violet-100 to-purple-200",
    border: "border-violet-300",
    icon: "bg-violet-200 text-violet-700",
    label: "text-violet-600",
    pill: "bg-violet-200 text-violet-800",
    bar: "bg-gradient-to-r from-violet-500 to-purple-500",
    hover: "hover:border-violet-400 hover:shadow-violet-200/60",
  },
  {
    gradient: "from-cyan-100 to-sky-200",
    border: "border-cyan-300",
    icon: "bg-cyan-200 text-cyan-700",
    label: "text-cyan-600",
    pill: "bg-cyan-200 text-cyan-800",
    bar: "bg-gradient-to-r from-cyan-500 to-sky-500",
    hover: "hover:border-cyan-400 hover:shadow-cyan-200/60",
  },
  {
    gradient: "from-emerald-100 to-teal-200",
    border: "border-emerald-300",
    icon: "bg-emerald-200 text-emerald-700",
    label: "text-emerald-600",
    pill: "bg-emerald-200 text-emerald-800",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-500",
    hover: "hover:border-emerald-400 hover:shadow-emerald-200/60",
  },
  {
    gradient: "from-amber-100 to-orange-200",
    border: "border-amber-300",
    icon: "bg-amber-200 text-amber-700",
    label: "text-amber-600",
    pill: "bg-amber-200 text-amber-800",
    bar: "bg-gradient-to-r from-amber-500 to-orange-500",
    hover: "hover:border-amber-400 hover:shadow-amber-200/60",
  },
  {
    gradient: "from-rose-100 to-pink-200",
    border: "border-rose-300",
    icon: "bg-rose-200 text-rose-700",
    label: "text-rose-600",
    pill: "bg-rose-200 text-rose-800",
    bar: "bg-gradient-to-r from-rose-500 to-pink-500",
    hover: "hover:border-rose-400 hover:shadow-rose-200/60",
  },
  {
    gradient: "from-indigo-100 to-blue-200",
    border: "border-indigo-300",
    icon: "bg-indigo-200 text-indigo-700",
    label: "text-indigo-600",
    pill: "bg-indigo-200 text-indigo-800",
    bar: "bg-gradient-to-r from-indigo-500 to-blue-500",
    hover: "hover:border-indigo-400 hover:shadow-indigo-200/60",
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
  const [isAdmin, setIsAdmin] = useState(false);

  // Admin add-subject form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    apiClient.checkIsAdmin().then(setIsAdmin).catch(() => {});
  }, []);

  const lastCategoryRef = useRef("");

  useEffect(() => {
    if (lastCategoryRef.current === category) return;
    lastCategoryRef.current = category;
    (async () => {
      if (!category) return;
      setLoading(true);
      const fetched = await apiClient.listUSATCategorySubjects(category);
      setSubjects(fetched);
    })()
      .catch(() => setSubjects([]))
      .finally(() => setLoading(false));
  }, [category]);

  const handleAddSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || busy) return;
    setBusy(true);
    try {
      const created = await apiClient.createSubject({ name: newName.trim(), exam_type: category });
      setSubjects((prev) => [...prev, created]);
      setNewName("");
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.message || "Failed to create subject");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubject = async (id: number) => {
    if (!confirm("Delete this subject and all its chapters/MCQs?")) return;
    try {
      await apiClient.deleteSubject(id);
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete subject");
    }
  };

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
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.055, duration: 0.4, ease: "easeOut" }}
                    className="relative"
                  >
                    {/* Admin delete badge */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-md transition hover:bg-rose-600"
                        title="Delete subject"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        navigate(`/usat/${encodeURIComponent(category)}/${slugify(subject.name)}`)
                      }
                      className={`card-hover group relative w-full overflow-hidden rounded-2xl border-2 bg-gradient-to-br p-5 text-left shadow-lg transition-shadow duration-300 ${style.gradient} ${style.border} ${style.hover} hover:shadow-xl`}
                    >
                      {/* top accent bar */}
                      <div className={`absolute top-0 left-0 h-1.5 w-full ${style.bar}`} />

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
                  </motion.div>
                );
              })}

              {/* Admin: Add Subject card */}
              {isAdmin && !showAddForm && (
                <motion.button
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setShowAddForm(true)}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-white/60 p-5 text-violet-500 transition hover:border-violet-400 hover:bg-violet-50/60"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-bold">Add Subject</span>
                </motion.button>
              )}

              {/* Admin: Inline add form */}
              {isAdmin && showAddForm && (
                <motion.form
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onSubmit={handleAddSubject}
                  className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-white p-5 shadow-md"
                >
                  <p className="text-xs font-bold uppercase tracking-widest text-violet-500">New Subject</p>
                  <input
                    type="text"
                    placeholder="Subject name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy || !newName.trim()}
                      className="flex-1 rounded-xl bg-violet-600 py-2 text-xs font-bold text-white transition hover:bg-violet-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddForm(false); setNewName(""); }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.form>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default USATSubjects;
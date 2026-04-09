import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileText, Flame, Layers, Lightbulb, ListChecks } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Material, Subject, Tip, Topic } from "@/services/api";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveMaterialLink = (content: string): string | null => {
  const trimmed = (content || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return `${window.location.origin}${trimmed}`;
  return null;
};

const readYear = (title: string): string => {
  const match = title.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : "N/A";
};

const USATSubjectChapters = () => {
  const { category = "", subject = "" } = useParams();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Topic[]>([]);
  const [subjectNotes, setSubjectNotes] = useState<Material[]>([]);
  const [subjectPapers, setSubjectPapers] = useState<Material[]>([]);
  const [subjectTips, setSubjectTips] = useState<Tip[]>([]);
  const [chapterMaterialsById, setChapterMaterialsById] = useState<Record<number, Material[]>>({});
  const [chapterMcqsById, setChapterMcqsById] = useState<Record<number, MCQ[]>>({});
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    (async () => {
      if (!category || !subject) return;
      setLoading(true);
      const fetchedSubjects = await apiClient.listUSATCategorySubjects(category);
      const matched = fetchedSubjects.find((item) => slugify(item.name) === subject) || null;
      setSubjectInfo(matched);

      if (!matched) {
        setChapters([]);
        setSubjectNotes([]);
        setSubjectPapers([]);
        setSubjectTips([]);
        setSelectedChapterId(null);
        return;
      }

      const [fetchedChapters, notes, papers, tips] = await Promise.all([
        apiClient.listTopics(matched.id),
        apiClient.listSubjectMaterials(matched.id),
        apiClient.listSubjectPastPapers(matched.id),
        apiClient.listSubjectTips(matched.id),
      ]);

      setChapters(fetchedChapters);
      setSubjectNotes(notes);
      setSubjectPapers(papers);
      setSubjectTips(tips);
      setSelectedChapterId(fetchedChapters[0]?.id ?? null);
    })()
      .catch(() => {
        setSubjectInfo(null);
        setChapters([]);
        setSubjectNotes([]);
        setSubjectPapers([]);
        setSubjectTips([]);
      })
      .finally(() => setLoading(false));
  }, [category, subject]);

  useEffect(() => {
    (async () => {
      if (!selectedChapterId) return;
      if (chapterMaterialsById[selectedChapterId] && chapterMcqsById[selectedChapterId]) return;

      const [materials, mcqs] = await Promise.all([
        apiClient.listMaterials(selectedChapterId),
        apiClient.listMCQs(selectedChapterId),
      ]);
      setChapterMaterialsById((prev) => ({ ...prev, [selectedChapterId]: materials }));
      setChapterMcqsById((prev) => ({ ...prev, [selectedChapterId]: mcqs }));
    })().catch(() => {});
  }, [selectedChapterId, chapterMaterialsById, chapterMcqsById]);

  const selectedChapter = useMemo(
    () => chapters.find((chapterItem) => chapterItem.id === selectedChapterId) || null,
    [chapters, selectedChapterId]
  );
  const selectedChapterMaterials = selectedChapterId ? chapterMaterialsById[selectedChapterId] || [] : [];
  const selectedChapterMcqs = selectedChapterId ? chapterMcqsById[selectedChapterId] || [] : [];

  return (
    <>
      <Navbar />

      {/* ── page wrapper ── */}
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-24 pb-20">

        {/* decorative blobs */}
        <motion.div
          aria-hidden
          animate={{ x: [0, 22, 0], y: [0, -18, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -18, 0], y: [0, 20, 0] }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute right-0 top-32 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, 12, 0], y: [0, -10, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-400/15 blur-3xl"
        />

        <div className="container relative z-10 mx-auto px-4">

          {/* ── HERO HEADER ── */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-8 shadow-2xl shadow-violet-500/30"
          >
            {/* back link */}
            <Link
              to={`/usat/${encodeURIComponent(category)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Subjects
            </Link>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
              {subjectInfo?.name || "Subject"}
            </h1>
            <p className="mt-1 text-sm font-medium text-violet-200">{category} · Chapters Window</p>

            {/* stat chips */}
            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { label: "Chapters", value: chapters.length, color: "bg-white/20 text-white" },
                { label: "Subject Notes", value: subjectNotes.length, color: "bg-cyan-400/30 text-cyan-100" },
                { label: "Past Papers", value: subjectPapers.length, color: "bg-fuchsia-400/30 text-fuchsia-100" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`${stat.color} flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold backdrop-blur-sm`}
                >
                  <span className="text-xl font-black">{stat.value}</span>
                  <span className="opacity-80">{stat.label}</span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── LOADING SKELETON ── */}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">

              {/* ── LEFT COLUMN ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"
              >
                {/* Chapters list */}
                <div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-lg shadow-violet-100/40">
                  <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-violet-700">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                      <Layers className="h-4 w-4 text-violet-600" />
                    </span>
                    Chapters
                  </h2>

                  {chapters.length === 0 ? (
                    <p className="text-sm text-slate-400">No chapters available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {chapters.map((chapter, index) => (
                        <motion.button
                          key={chapter.id}
                          whileHover={{ x: 3 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                          onClick={() => setSelectedChapterId(chapter.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                            selectedChapterId === chapter.id
                              ? "border-violet-300 bg-gradient-to-r from-violet-50 to-fuchsia-50 shadow-md shadow-violet-100"
                              : "border-slate-100 bg-slate-50/70 hover:border-violet-200 hover:bg-violet-50/50"
                          }`}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${
                            selectedChapterId === chapter.id ? "text-violet-500" : "text-slate-400"
                          }`}>
                            Ch {String(index + 1).padStart(2, "0")}
                          </span>
                          <p className={`mt-0.5 text-sm font-semibold leading-snug ${
                            selectedChapterId === chapter.id ? "text-violet-900" : "text-slate-700"
                          }`}>
                            {chapter.title}
                          </p>
                          {selectedChapterId === chapter.id && (
                            <div className="mt-1.5 h-0.5 w-8 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chapter resources + MCQs */}
                <div className="flex flex-col gap-4">

                  {/* Materials card */}
                  <div className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-lg shadow-cyan-100/30">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-cyan-700">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-100">
                          <FileText className="h-3.5 w-3.5 text-cyan-600" />
                        </span>
                        {selectedChapter?.title || "Chapter"} Resources
                      </h3>
                      <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-bold text-cyan-700">
                        {selectedChapterMaterials.length}
                      </span>
                    </div>

                    {selectedChapterMaterials.length === 0 ? (
                      <p className="text-xs text-slate-400">No chapter materials yet.</p>
                    ) : (
                      <div className="max-h-56 space-y-2 overflow-auto pr-1">
                        {selectedChapterMaterials.map((material) => {
                          const href = resolveMaterialLink(material.content);
                          return (
                            <div key={material.id} className="rounded-xl border border-cyan-50 bg-gradient-to-r from-cyan-50/60 to-sky-50/60 p-2.5">
                              <p className="text-xs font-semibold text-slate-800">{material.title}</p>
                              {href ? (
                                <a
                                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-600 px-2.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-cyan-700"
                                  href={href}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  View <Download className="h-2.5 w-2.5" />
                                </a>
                              ) : (
                                <p className="mt-1 text-xs text-slate-500 line-clamp-3">{material.content}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* MCQs card */}
                  <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-lg shadow-emerald-100/30">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100">
                          <ListChecks className="h-3.5 w-3.5 text-emerald-600" />
                        </span>
                        {selectedChapter?.title || "Chapter"} MCQs
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        {selectedChapterMcqs.length} Qs
                      </span>
                    </div>

                    {selectedChapterMcqs.length === 0 ? (
                      <p className="text-xs text-slate-400">No chapter MCQs yet.</p>
                    ) : (
                      <div className="max-h-56 space-y-2 overflow-auto pr-1">
                        {selectedChapterMcqs.slice(0, 8).map((mcq, index) => (
                          <div key={mcq.id} className="rounded-xl border border-emerald-50 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 p-2.5">
                            <p className="text-xs font-semibold text-slate-800">Q{index + 1}. {mcq.question}</p>
                            <span className="mt-1.5 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              ✓ {mcq.correct_answer}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>

              {/* ── RIGHT COLUMN ── */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.08, ease: "easeOut" }}
                className="space-y-5"
              >

                {/* Subject Notes */}
                <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-100/30">
                  <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                      <FileText className="h-4 w-4" /> Subject Notes
                    </h3>
                  </div>
                  <div className="p-4">
                    {subjectNotes.length === 0 ? (
                      <p className="text-xs text-slate-400">No subject notes yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectNotes.slice(0, 6).map((note, i) => (
                          <div key={note.id} className="flex items-center gap-2.5 rounded-xl border border-violet-50 bg-violet-50/60 p-2.5 transition hover:bg-violet-100/50">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[10px] font-black text-violet-700">
                              {i + 1}
                            </span>
                            <p className="text-xs font-semibold text-slate-800">{note.title}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Past Papers */}
                <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-lg shadow-orange-100/30">
                  <div className="bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Flame className="h-4 w-4" /> Past Papers
                    </h3>
                  </div>
                  <div className="p-4">
                    {subjectPapers.length === 0 ? (
                      <p className="text-xs text-slate-400">No past papers yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectPapers.slice(0, 6).map((paper) => {
                          const href = resolveMaterialLink(paper.content);
                          return (
                            <div key={paper.id} className="rounded-xl border border-orange-50 bg-gradient-to-r from-orange-50/70 to-rose-50/70 p-2.5">
                              <p className="text-xs font-semibold text-slate-800">{paper.title}</p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                  {readYear(paper.title)}
                                </span>
                                {href && (
                                  <a
                                    className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white transition hover:bg-orange-600"
                                    href={href}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Open <Download className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tips & Tricks */}
                <div className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-lg shadow-teal-100/30">
                  <div className="bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                      <Lightbulb className="h-4 w-4" /> Tips & Tricks
                    </h3>
                  </div>
                  <div className="p-4">
                    {subjectTips.length === 0 ? (
                      <p className="text-xs text-slate-400">No tips yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {subjectTips.map((tip) => (
                          <div key={tip.id} className="rounded-xl border border-teal-50 bg-gradient-to-r from-teal-50/60 to-cyan-50/60 p-2.5">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-base">💡</span>
                              <div>
                                <p className="text-xs font-bold text-teal-800">{tip.title}</p>
                                <p className="mt-0.5 text-xs text-slate-600 line-clamp-4">{tip.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </motion.div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default USATSubjectChapters;
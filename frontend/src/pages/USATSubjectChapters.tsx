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
    })().catch(() => {
      // keep current UI state if chapter load fails
    });
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
      <div className="relative min-h-screen overflow-hidden bg-white pt-24 pb-16">
        <motion.div
          aria-hidden
          animate={{ x: [0, 18, 0], y: [0, -14, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -left-20 top-12 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl"
        />
        <motion.div
          aria-hidden
          animate={{ x: [0, -16, 0], y: [0, 14, 0] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-amber-300/25 blur-3xl"
        />

        <div className="container relative z-10 mx-auto px-4">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mb-6 rounded-3xl border border-cyan-100 bg-gradient-to-br from-white via-sky-50 to-cyan-100/80 p-6 shadow-xl ring-1 ring-cyan-100/70"
          >
            <Link to={`/usat/${encodeURIComponent(category)}`} className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline">
              <ArrowLeft className="h-4 w-4" /> Back to Subjects
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{subjectInfo?.name || "Subject"}</h1>
            <p className="mt-1 text-sm text-slate-600">{category} • Chapters Window</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Chapters</p>
                <p className="font-semibold text-slate-900">{chapters.length}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Subject Notes</p>
                <p className="font-semibold text-slate-900">{subjectNotes.length}</p>
              </div>
              <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm shadow-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Past Papers</p>
                <p className="font-semibold text-slate-900">{subjectPapers.length}</p>
              </div>
            </div>
          </motion.section>

          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><Layers className="h-4 w-4 text-indigo-700" /> Chapters</h2>
                  {chapters.length === 0 ? (
                    <p className="text-sm text-slate-500">No chapters available yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {chapters.map((chapter, index) => (
                        <button
                          key={chapter.id}
                          onClick={() => setSelectedChapterId(chapter.id)}
                          className={`w-full rounded-xl border p-3 text-left transition-all ${
                            selectedChapterId === chapter.id
                              ? "border-cyan-300 bg-gradient-to-r from-cyan-50 to-sky-50 shadow-sm"
                              : "border-slate-200 bg-slate-50 hover:border-cyan-200"
                          }`}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Chapter {index + 1}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{chapter.title}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800"><FileText className="h-4 w-4" /> {selectedChapter?.title || "Chapter"} Resources</h3>
                    <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[11px] font-semibold text-cyan-800">
                      {selectedChapterMaterials.length} materials
                    </span>
                  </div>
                  {selectedChapterMaterials.length === 0 ? (
                    <p className="text-xs text-slate-500">No chapter materials yet.</p>
                  ) : (
                    <div className="max-h-64 space-y-2 overflow-auto pr-1">
                      {selectedChapterMaterials.map((material) => {
                        const href = resolveMaterialLink(material.content);
                        return (
                          <div key={material.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-xs font-semibold text-slate-900">{material.title}</p>
                            {href ? (
                              <a className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline" href={href} target="_blank" rel="noreferrer">
                                View <Download className="h-3 w-3" />
                              </a>
                            ) : (
                              <p className="mt-1 text-xs text-slate-600 line-clamp-3">{material.content}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800"><ListChecks className="h-4 w-4" /> {selectedChapter?.title || "Chapter"} MCQs</h3>
                      <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                        {selectedChapterMcqs.length} questions
                      </span>
                    </div>
                    {selectedChapterMcqs.length === 0 ? (
                      <p className="text-xs text-slate-500">No chapter MCQs yet.</p>
                    ) : (
                      <div className="max-h-64 space-y-2 overflow-auto pr-1">
                        {selectedChapterMcqs.slice(0, 8).map((mcq, index) => (
                          <div key={mcq.id} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-xs font-semibold text-slate-900">Q{index + 1}. {mcq.question}</p>
                            <p className="mt-1 text-xs text-emerald-700">Correct: {mcq.correct_answer}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.06, ease: "easeOut" }}
                className="space-y-4"
              >
                <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-white to-cyan-50/70 p-4 shadow-sm ring-1 ring-cyan-100/60">
                  <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-800"><FileText className="h-4 w-4" /> Subject Notes</h3>
                  {subjectNotes.length === 0 ? (
                    <p className="text-xs text-slate-500">No subject notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subjectNotes.slice(0, 6).map((note) => (
                        <div key={note.id} className="rounded-lg border border-slate-200 bg-white p-2">
                          <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-orange-50/70 p-4 shadow-sm ring-1 ring-amber-100/80">
                  <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-800"><Flame className="h-4 w-4" /> Past Papers</h3>
                  {subjectPapers.length === 0 ? (
                    <p className="text-xs text-slate-500">No past papers yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subjectPapers.slice(0, 6).map((paper) => {
                        const href = resolveMaterialLink(paper.content);
                        return (
                          <div key={paper.id} className="rounded-lg border border-amber-200 bg-white p-2">
                            <p className="text-xs font-semibold text-slate-900">{paper.title}</p>
                            <p className="mt-1 text-xs text-slate-600">Year: {readYear(paper.title)}</p>
                            {href && (
                              <a className="mt-1 inline-flex items-center gap-1 text-xs text-amber-800 hover:underline" href={href} target="_blank" rel="noreferrer">
                                Open <Download className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-lime-50/60 p-4 shadow-sm ring-1 ring-emerald-100/80">
                  <h3 className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-slate-800"><Lightbulb className="h-4 w-4" /> Tips & Tricks</h3>
                  {subjectTips.length === 0 ? (
                    <p className="text-xs text-slate-500">No tips yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {subjectTips.map((tip) => (
                        <div key={tip.id} className="rounded-lg border border-emerald-200 bg-white p-2">
                          <p className="text-xs font-semibold text-slate-900">{tip.title}</p>
                          <p className="mt-1 text-xs text-slate-700 line-clamp-4">{tip.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
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

import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ChevronDown, Download, FileText, Flame, Layers, Lightbulb, ListChecks, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Note, PastPaper, Resource, Subject, Tip, Topic } from "@/services/api";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveLink = (value: string): string | null => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return `${window.location.origin}${trimmed}`;
  return null;
};

const readYear = (title: string): string => {
  const match = title.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : "N/A";
};

const MCQ_PAGE_SIZE = 30;

const USATSubjectChapters = () => {
  const { category = "", subject = "" } = useParams();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Topic[]>([]);
  const [subjectNotes, setSubjectNotes] = useState<Note[]>([]);
  const [subjectPapers, setSubjectPapers] = useState<PastPaper[]>([]);
  const [subjectTips, setSubjectTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(false);

  // Accordion state
  const [expandedChapterId, setExpandedChapterId] = useState<number | null>(null);

  // Per-chapter lazy-loaded data
  const [chapterResourcesById, setChapterResourcesById] = useState<Record<number, Resource[]>>({});
  const [chapterNotesById, setChapterNotesById] = useState<Record<number, Note[]>>({});
  const [chapterMcqsById, setChapterMcqsById] = useState<Record<number, MCQ[]>>({});
  const [chapterMcqOffsets, setChapterMcqOffsets] = useState<Record<number, number>>({});
  const [chapterMcqHasMore, setChapterMcqHasMore] = useState<Record<number, boolean>>({});
  const [chapterLoadingById, setChapterLoadingById] = useState<Record<number, boolean>>({});
  const [chapterMcqLoadingById, setChapterMcqLoadingById] = useState<Record<number, boolean>>({});

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
        setExpandedChapterId(null);
        return;
      }

      const [fetchedChapters, notes, papers, tips] = await Promise.all([
        apiClient.listTopics(matched.id),
        apiClient.listSubjectNotes(matched.id),
        apiClient.listSubjectPapers(matched.id),
        apiClient.listSubjectTips(matched.id),
      ]);

      setChapters(fetchedChapters);
      setSubjectNotes(notes);
      setSubjectPapers(papers);
      setSubjectTips(tips);
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

  const loadChapterData = useCallback(
    async (chapterId: number) => {
      if (chapterLoadingById[chapterId]) return;
      // Already loaded
      if (chapterResourcesById[chapterId] !== undefined) return;

      setChapterLoadingById((prev) => ({ ...prev, [chapterId]: true }));
      try {
        const [resources, notes, mcqs] = await Promise.all([
          apiClient.listChapterResources(chapterId),
          apiClient.listChapterNotes(chapterId),
          apiClient.listChapterMCQsPaginated(chapterId, MCQ_PAGE_SIZE, 0),
        ]);
        setChapterResourcesById((prev) => ({ ...prev, [chapterId]: resources }));
        setChapterNotesById((prev) => ({ ...prev, [chapterId]: notes }));
        setChapterMcqsById((prev) => ({ ...prev, [chapterId]: mcqs }));
        setChapterMcqOffsets((prev) => ({ ...prev, [chapterId]: MCQ_PAGE_SIZE }));
        setChapterMcqHasMore((prev) => ({ ...prev, [chapterId]: mcqs.length === MCQ_PAGE_SIZE }));
      } finally {
        setChapterLoadingById((prev) => ({ ...prev, [chapterId]: false }));
      }
    },
    [chapterLoadingById, chapterResourcesById]
  );

  const toggleChapter = useCallback(
    (chapterId: number) => {
      if (expandedChapterId === chapterId) {
        setExpandedChapterId(null);
        return;
      }
      setExpandedChapterId(chapterId);
      loadChapterData(chapterId).catch(() => {});
    },
    [expandedChapterId, loadChapterData]
  );

  const loadMoreMCQs = useCallback(
    async (chapterId: number) => {
      if (chapterMcqLoadingById[chapterId]) return;
      const currentOffset = chapterMcqOffsets[chapterId] ?? 0;
      setChapterMcqLoadingById((prev) => ({ ...prev, [chapterId]: true }));
      try {
        const moreMcqs = await apiClient.listChapterMCQsPaginated(chapterId, MCQ_PAGE_SIZE, currentOffset);
        setChapterMcqsById((prev) => ({
          ...prev,
          [chapterId]: [...(prev[chapterId] || []), ...moreMcqs],
        }));
        setChapterMcqOffsets((prev) => ({ ...prev, [chapterId]: currentOffset + MCQ_PAGE_SIZE }));
        setChapterMcqHasMore((prev) => ({ ...prev, [chapterId]: moreMcqs.length === MCQ_PAGE_SIZE }));
      } finally {
        setChapterMcqLoadingById((prev) => ({ ...prev, [chapterId]: false }));
      }
    },
    [chapterMcqLoadingById, chapterMcqOffsets]
  );

  return (
    <>
      <Navbar />

      {/* â”€â”€ page wrapper â”€â”€ */}
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

          {/* â”€â”€ HERO HEADER â”€â”€ */}
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
            <p className="mt-1 text-sm font-medium text-violet-200">{category} Â· Chapters Window</p>

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

          {/* â”€â”€ LOADING SKELETON â”€â”€ */}
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
              <div className="h-64 animate-pulse rounded-2xl bg-white/60 shadow-sm" />
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">

              {/* â”€â”€ LEFT COLUMN â€“ Accordion Chapters â”€â”€ */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              >
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
                      {chapters.map((chapter, index) => {
                        const isExpanded = expandedChapterId === chapter.id;
                        const resources = chapterResourcesById[chapter.id] ?? [];
                        const notes = chapterNotesById[chapter.id] ?? [];
                        const mcqs = chapterMcqsById[chapter.id] ?? [];
                        const isLoading = !!chapterLoadingById[chapter.id];
                        const isMcqLoading = !!chapterMcqLoadingById[chapter.id];
                        const hasMoreMcqs = !!chapterMcqHasMore[chapter.id];

                        return (
                          <div
                            key={chapter.id}
                            className={`overflow-hidden rounded-xl border transition-all duration-200 ${
                              isExpanded
                                ? "border-violet-300 shadow-md shadow-violet-100"
                                : "border-slate-100"
                            }`}
                          >
                            {/* Chapter header â€“ click to expand/collapse */}
                            <button
                              type="button"
                              onClick={() => toggleChapter(chapter.id)}
                              className={`flex w-full items-center justify-between p-3 text-left transition-colors duration-200 ${
                                isExpanded
                                  ? "bg-gradient-to-r from-violet-50 to-fuchsia-50"
                                  : "bg-slate-50/70 hover:bg-violet-50/50"
                              }`}
                            >
                              <div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                  isExpanded ? "text-violet-500" : "text-slate-400"
                                }`}>
                                  Ch {String(index + 1).padStart(2, "0")}
                                </span>
                                <p className={`mt-0.5 text-sm font-semibold leading-snug ${
                                  isExpanded ? "text-violet-900" : "text-slate-700"
                                }`}>
                                  {chapter.title}
                                </p>
                              </div>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${
                                  isExpanded ? "rotate-180 text-violet-500" : ""
                                }`}
                              />
                            </button>

                            {/* Accordion body */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  key="content"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-violet-100 p-4 space-y-4">
                                    {isLoading ? (
                                      <div className="flex items-center justify-center gap-2 py-4 text-slate-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span className="text-xs">Loading chapter contentâ€¦</span>
                                      </div>
                                    ) : (
                                      <>
                                        {/* â”€â”€ Resources â”€â”€ */}
                                        <div>
                                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-cyan-700">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-cyan-100">
                                              <FileText className="h-3 w-3 text-cyan-600" />
                                            </span>
                                            Resources
                                            <span className="ml-auto rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700">
                                              {resources.length}
                                            </span>
                                          </h4>
                                          {resources.length === 0 ? (
                                            <p className="text-xs text-slate-400">No resources added yet.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {resources.map((resource) => {
                                                const href = resolveLink(resource.url);
                                                return (
                                                  <div
                                                    key={resource.id}
                                                    className="rounded-lg border border-cyan-50 bg-gradient-to-r from-cyan-50/60 to-sky-50/60 p-2"
                                                  >
                                                    <p className="text-xs font-semibold text-slate-800">{resource.title}</p>
                                                    {href ? (
                                                      <a
                                                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-cyan-600 px-2.5 py-0.5 text-[10px] font-semibold text-white transition hover:bg-cyan-700"
                                                        href={href}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                      >
                                                        Open <Download className="h-2.5 w-2.5" />
                                                      </a>
                                                    ) : (
                                                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{resource.url}</p>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        {/* â”€â”€ Chapter Notes (only if any) â”€â”€ */}
                                        {notes.length > 0 && (
                                          <div>
                                            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-violet-700">
                                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100">
                                                <FileText className="h-3 w-3 text-violet-600" />
                                              </span>
                                              Chapter Notes
                                              <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                                                {notes.length}
                                              </span>
                                            </h4>
                                            <div className="space-y-1.5">
                                              {notes.map((note, ni) => (
                                                <div
                                                  key={note.id}
                                                  className="flex items-start gap-2 rounded-lg border border-violet-50 bg-violet-50/60 p-2"
                                                >
                                                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-200 text-[9px] font-black text-violet-700 mt-0.5">
                                                    {ni + 1}
                                                  </span>
                                                  <div>
                                                    <p className="text-xs font-semibold text-slate-800">{note.title}</p>
                                                    {note.content && (
                                                      <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-3">{note.content}</p>
                                                    )}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* â”€â”€ MCQs â”€â”€ */}
                                        <div>
                                          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100">
                                              <ListChecks className="h-3 w-3 text-emerald-600" />
                                            </span>
                                            MCQs
                                            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                              {mcqs.length} loaded
                                            </span>
                                          </h4>
                                          {mcqs.length === 0 ? (
                                            <p className="text-xs text-slate-400">No MCQs added yet.</p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {mcqs.map((mcq, qi) => (
                                                <div
                                                  key={mcq.id}
                                                  className="rounded-lg border border-emerald-50 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 p-2"
                                                >
                                                  <p className="text-xs font-semibold text-slate-800">
                                                    Q{qi + 1}. {mcq.question}
                                                  </p>
                                                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-slate-600">
                                                    {(["A", "B", "C", "D"] as const).map((opt) => (
                                                      <span
                                                        key={opt}
                                                        className={`rounded px-1.5 py-0.5 font-medium ${
                                                          mcq.correct_answer === opt
                                                            ? "bg-emerald-600 text-white"
                                                            : "bg-slate-100 text-slate-600"
                                                        }`}
                                                      >
                                                        {opt}. {mcq[`option_${opt.toLowerCase()}` as keyof MCQ] as string}
                                                      </span>
                                                    ))}
                                                  </div>
                                                  {mcq.explanation && (
                                                    <p className="mt-1 text-[10px] italic text-slate-400 line-clamp-2">
                                                      {mcq.explanation}
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {/* Load More MCQs */}
                                          {hasMoreMcqs && (
                                            <button
                                              type="button"
                                              onClick={() => loadMoreMCQs(chapter.id)}
                                              disabled={isMcqLoading}
                                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                              {isMcqLoading ? (
                                                <><Loader2 className="h-3 w-3 animate-spin" /> Loadingâ€¦</>
                                              ) : (
                                                "Load More MCQs"
                                              )}
                                            </button>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* â”€â”€ RIGHT COLUMN â”€â”€ */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.48, delay: 0.08, ease: "easeOut" }}
                className="space-y-5"
              >

                {/* Subject Notes â€“ only rendered if notes exist */}
                {subjectNotes.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-lg shadow-violet-100/30">
                    <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-5 py-3">
                      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                        <FileText className="h-4 w-4" /> Subject Notes
                      </h3>
                    </div>
                    <div className="p-4">
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
                    </div>
                  </div>
                )}

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
                          const href = resolveLink(paper.file_path);
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
                      <Lightbulb className="h-4 w-4" /> Tips &amp; Tricks
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
                              <span className="mt-0.5 text-base">ðŸ’¡</span>
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

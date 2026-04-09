import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Clock3, Download, FileText, Flame, Layers, Lightbulb, ListChecks, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Material, Subject, Tip, Topic, USATCategory } from "@/services/api";

const CATEGORY_CARD_STYLES: Record<string, string> = {
  "USAT-E": "from-cyan-100 via-sky-100 to-blue-100 border-cyan-200",
  "USAT-M": "from-emerald-100 via-green-100 to-lime-100 border-emerald-200",
  "USAT-CS": "from-indigo-100 via-blue-100 to-cyan-100 border-indigo-200",
  "USAT-GS": "from-amber-100 via-yellow-100 to-orange-100 border-amber-200",
  "USAT-A": "from-rose-100 via-orange-100 to-amber-100 border-rose-200",
};

const CATEGORY_GLOW_STYLES: Record<string, string> = {
  "USAT-E": "from-cyan-300/30 via-sky-300/20 to-blue-300/20",
  "USAT-M": "from-emerald-300/30 via-green-300/20 to-lime-300/20",
  "USAT-CS": "from-indigo-300/30 via-blue-300/20 to-cyan-300/20",
  "USAT-GS": "from-amber-300/30 via-yellow-300/20 to-orange-300/20",
  "USAT-A": "from-rose-300/30 via-orange-300/20 to-amber-300/20",
};

const examInfo = [
  { label: "Verbal Reasoning", marks: "20" },
  { label: "Quantitative Reasoning", marks: "25" },
  { label: "Subject Knowledge", marks: "30" },
  { label: "Essay Writing", marks: "25" },
];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

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

const USAT = () => {
  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [subjectsByCategory, setSubjectsByCategory] = useState<Record<string, Subject[]>>({});
  const [chaptersBySubject, setChaptersBySubject] = useState<Record<number, Topic[]>>({});
  const [chapterMaterialsById, setChapterMaterialsById] = useState<Record<number, Material[]>>({});
  const [chapterMcqsById, setChapterMcqsById] = useState<Record<number, MCQ[]>>({});
  const [subjectMaterialsById, setSubjectMaterialsById] = useState<Record<number, Material[]>>({});
  const [subjectPapersById, setSubjectPapersById] = useState<Record<number, Material[]>>({});
  const [subjectTipsById, setSubjectTipsById] = useState<Record<number, Tip[]>>({});

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubjectsByCategory, setLoadingSubjectsByCategory] = useState<Record<string, boolean>>({});
  const [loadingSubjectBundleById, setLoadingSubjectBundleById] = useState<Record<number, boolean>>({});
  const [loadingChapterById, setLoadingChapterById] = useState<Record<number, boolean>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingCategories(true);
      const fetchedCategories = await apiClient.listUSATCategories();
      setCategories(fetchedCategories);
    })()
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  }, []);

  const handleCategoryOpen = async (categoryCode: string) => {
    setSelectedChapter(null);
    if (selectedCategory === categoryCode) {
      setSelectedCategory(null);
      setSelectedSubject(null);
      return;
    }

    setSelectedCategory(categoryCode);
    setSelectedSubject(null);

    if (!subjectsByCategory[categoryCode]) {
      setLoadingSubjectsByCategory((prev) => ({ ...prev, [categoryCode]: true }));
      try {
        const fetched = await apiClient.listUSATCategorySubjects(categoryCode);
        setSubjectsByCategory((prev) => ({ ...prev, [categoryCode]: fetched }));
      } finally {
        setLoadingSubjectsByCategory((prev) => ({ ...prev, [categoryCode]: false }));
      }
    }
  };

  const loadSubjectBundle = async (subjectId: number) => {
    setLoadingSubjectBundleById((prev) => ({ ...prev, [subjectId]: true }));
    try {
      const [chapters, notes, papers, tips] = await Promise.all([
        apiClient.listTopics(subjectId),
        apiClient.listSubjectMaterials(subjectId),
        apiClient.listSubjectPastPapers(subjectId),
        apiClient.listSubjectTips(subjectId),
      ]);

      setChaptersBySubject((prev) => ({ ...prev, [subjectId]: chapters }));
      setSubjectMaterialsById((prev) => ({ ...prev, [subjectId]: notes }));
      setSubjectPapersById((prev) => ({ ...prev, [subjectId]: papers }));
      setSubjectTipsById((prev) => ({ ...prev, [subjectId]: tips }));
    } finally {
      setLoadingSubjectBundleById((prev) => ({ ...prev, [subjectId]: false }));
    }
  };

  const handleSubjectOpen = async (subjectId: number) => {
    setSelectedChapter(null);
    if (selectedSubject === subjectId) {
      setSelectedSubject(null);
      return;
    }

    setSelectedSubject(subjectId);
    if (!chaptersBySubject[subjectId]) {
      await loadSubjectBundle(subjectId);
    }
  };

  const handleChapterOpen = async (chapterId: number) => {
    if (selectedChapter === chapterId) {
      setSelectedChapter(null);
      return;
    }

    setSelectedChapter(chapterId);
    if (!chapterMaterialsById[chapterId] || !chapterMcqsById[chapterId]) {
      setLoadingChapterById((prev) => ({ ...prev, [chapterId]: true }));
      try {
        const [materials, mcqs] = await Promise.all([
          apiClient.listMaterials(chapterId),
          apiClient.listMCQs(chapterId),
        ]);
        setChapterMaterialsById((prev) => ({ ...prev, [chapterId]: materials }));
        setChapterMcqsById((prev) => ({ ...prev, [chapterId]: mcqs }));
      } finally {
        setLoadingChapterById((prev) => ({ ...prev, [chapterId]: false }));
      }
    }
  };

  const currentSubjects = selectedCategory ? subjectsByCategory[selectedCategory] || [] : [];
  const loadingCurrentSubjects = selectedCategory ? Boolean(loadingSubjectsByCategory[selectedCategory]) : false;
  const loadingCurrentSubjectBundle = selectedSubject ? Boolean(loadingSubjectBundleById[selectedSubject]) : false;
  const currentChapters = selectedSubject ? chaptersBySubject[selectedSubject] || [] : [];
  const currentSubjectNotes = selectedSubject ? subjectMaterialsById[selectedSubject] || [] : [];
  const currentSubjectPapers = selectedSubject ? subjectPapersById[selectedSubject] || [] : [];
  const currentSubjectTips = selectedSubject ? subjectTipsById[selectedSubject] || [] : [];
  const currentChapterMaterials = selectedChapter ? chapterMaterialsById[selectedChapter] || [] : [];
  const currentChapterMcqs = selectedChapter ? chapterMcqsById[selectedChapter] || [] : [];

  const selectedCategoryMeta = useMemo(
    () => categories.find((item) => item.code === selectedCategory),
    [categories, selectedCategory]
  );

  const selectedGlowClass = selectedCategory
    ? CATEGORY_GLOW_STYLES[selectedCategory] || "from-cyan-300/20 via-sky-300/20 to-blue-300/20"
    : "from-cyan-300/20 via-sky-300/20 to-blue-300/20";

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white pt-24 pb-14">
        <div className="container mx-auto px-4">
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 md:p-8 shadow-lg">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-800">
                    <Sparkles className="h-3.5 w-3.5" /> USAT Premium Preparation Space
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">USAT Focus Arena</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                    Tap a category card, open a subject, then drill into chapters to instantly access notes, MCQs, past papers, and strategy tips.
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
            </div>
          </motion.section>

          <section className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">Choose Your USAT Category</h2>
            {loadingCategories ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(5)].map((_, index) => (
                  <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
                ))}
              </div>
            ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <motion.button
                  key={category.code}
                  variants={staggerItem}
                  transition={{ duration: 0.28, delay: index * 0.01 }}
                  onClick={() => void handleCategoryOpen(category.code)}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    CATEGORY_CARD_STYLES[category.code] || "from-white to-slate-100 border-slate-200"
                  } ${selectedCategory === category.code ? "ring-2 ring-cyan-500" : ""}`}
                >
                  {selectedCategory === category.code && (
                    <motion.div
                      layoutId="active-category-indicator"
                      className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"
                    />
                  )}
                  <div className="mb-2 inline-flex rounded-md bg-white/70 px-2 py-1 text-xs font-bold text-slate-800">{category.code}</div>
                  <h3 className="text-base font-bold text-slate-900">{category.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{category.description}</p>
                </motion.button>
              ))}
            </motion.div>
            )}
          </section>

          <AnimatePresence mode="wait">
            {selectedCategory && (
            <motion.section
              key={selectedCategory}
              initial={{ opacity: 0, y: 12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm"
            >
              <div className={`pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-gradient-to-br blur-3xl ${selectedGlowClass}`} />
              <div className={`pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-gradient-to-tr blur-3xl ${selectedGlowClass}`} />
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedCategoryMeta?.code} Subjects</h3>
                  <p className="text-sm text-slate-600">{selectedCategoryMeta?.description}</p>
                </div>
                <Link to="/admin" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Manage Content
                </Link>
              </div>

              {loadingCurrentSubjects ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {[...Array(4)].map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
                  ))}
                </div>
              ) : currentSubjects.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">No subjects available in this category yet.</div>
              ) : (
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid gap-3 md:grid-cols-2">
                  {currentSubjects.map((subject, subjectIndex) => (
                    <motion.div key={subject.id} variants={staggerItem} transition={{ duration: 0.25, delay: subjectIndex * 0.01 }} className="relative rounded-2xl border border-slate-200 bg-white p-4">
                      {selectedSubject === subject.id && (
                        <motion.div layoutId="active-subject-indicator" className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-cyan-500 to-blue-500" />
                      )}
                      <button onClick={() => void handleSubjectOpen(subject.id)} className="w-full text-left">
                        <p className="inline-flex items-center gap-2 text-lg font-bold text-slate-900"><BookOpen className="h-4 w-4 text-cyan-700" /> {subject.name}</p>
                        <p className="mt-1 text-sm text-slate-600">Open chapters and resources</p>
                      </button>

                      <AnimatePresence>
                      {selectedSubject === subject.id && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -8, height: 0 }}
                          transition={{ duration: 0.24 }}
                          className="mt-4 space-y-4 overflow-hidden"
                        >
                          <div>
                            <p className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Layers className="h-4 w-4 text-indigo-700" /> Chapters</p>
                            {loadingCurrentSubjectBundle ? (
                              <div className="space-y-2">
                                {[...Array(3)].map((_, index) => (
                                  <div key={index} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
                                ))}
                              </div>
                            ) : currentChapters.length === 0 ? (
                              <p className="text-sm text-slate-500">No chapters yet.</p>
                            ) : (
                              <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
                                {currentChapters.map((chapter) => (
                                  <motion.div key={chapter.id} variants={staggerItem} className="relative rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    {selectedChapter === chapter.id && (
                                      <motion.div layoutId="active-chapter-indicator" className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-gradient-to-b from-indigo-500 to-cyan-500" />
                                    )}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-sm font-semibold text-slate-900">{chapter.title}</p>
                                      <button
                                        onClick={() => void handleChapterOpen(chapter.id)}
                                        className="rounded-lg border border-cyan-300 bg-white px-2.5 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-50"
                                      >
                                        Open Chapter
                                      </button>
                                    </div>

                                    <AnimatePresence>
                                    {selectedChapter === chapter.id && (
                                      <motion.div
                                        initial={{ opacity: 0, y: 8, height: 0 }}
                                        animate={{ opacity: 1, y: 0, height: "auto" }}
                                        exit={{ opacity: 0, y: -6, height: 0 }}
                                        transition={{ duration: 0.22 }}
                                        className="mt-3 grid gap-3 overflow-hidden lg:grid-cols-2"
                                      >
                                        {loadingChapterById[chapter.id] ? (
                                          <>
                                            <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
                                            <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
                                          </>
                                        ) : (
                                          <>
                                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                                          <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600"><FileText className="h-3.5 w-3.5" /> Chapter Materials</p>
                                          {currentChapterMaterials.length === 0 ? (
                                            <p className="text-xs text-slate-500">No materials in this chapter.</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {currentChapterMaterials.map((material) => {
                                                const href = resolveMaterialLink(material.content);
                                                return (
                                                  <div key={material.id} className="rounded-md border border-slate-200 p-2">
                                                    <p className="text-xs font-semibold text-slate-900">{material.title}</p>
                                                    {href ? (
                                                      <a className="mt-1 inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline" href={href} target="_blank" rel="noreferrer">
                                                        View <Download className="h-3 w-3" />
                                                      </a>
                                                    ) : (
                                                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{material.content}</p>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>

                                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                                          <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600"><ListChecks className="h-3.5 w-3.5" /> Chapter MCQs</p>
                                          {currentChapterMcqs.length === 0 ? (
                                            <p className="text-xs text-slate-500">No MCQs in this chapter.</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {currentChapterMcqs.slice(0, 4).map((mcq, idx) => (
                                                <div key={mcq.id} className="rounded-md border border-slate-200 p-2">
                                                  <p className="text-xs font-semibold text-slate-900">Q{idx + 1}. {mcq.question}</p>
                                                  <p className="mt-1 text-xs text-emerald-700">Correct: {mcq.correct_answer}</p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                          </>
                                        )}
                                      </motion.div>
                                    )}
                                    </AnimatePresence>
                                  </motion.div>
                                ))}
                              </motion.div>
                            )}
                          </div>

                          <div className="grid gap-3 lg:grid-cols-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-600"><FileText className="h-3.5 w-3.5" /> Subject Notes</p>
                              {currentSubjectNotes.length === 0 ? (
                                <p className="text-xs text-slate-500">No notes yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {currentSubjectNotes.slice(0, 5).map((note) => (
                                    <div key={note.id} className="rounded-md border border-slate-200 bg-white p-2">
                                      <p className="text-xs font-semibold text-slate-900">{note.title}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-amber-50/50 p-3">
                              <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-700"><Flame className="h-3.5 w-3.5" /> Past Papers</p>
                              {currentSubjectPapers.length === 0 ? (
                                <p className="text-xs text-slate-500">No past papers yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {currentSubjectPapers.slice(0, 5).map((paper) => {
                                    const href = resolveMaterialLink(paper.content);
                                    return (
                                      <div key={paper.id} className="rounded-md border border-amber-200 bg-white p-2">
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

                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                              <p className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-700"><Lightbulb className="h-3.5 w-3.5" /> Tips & Tricks</p>
                              {currentSubjectTips.length === 0 ? (
                                <p className="text-xs text-slate-500">No tips yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {currentSubjectTips.map((tip) => (
                                    <div key={tip.id} className="rounded-md border border-emerald-200 bg-white p-2">
                                      <p className="text-xs font-semibold text-slate-900">{tip.title}</p>
                                      <p className="mt-1 text-xs text-slate-700 line-clamp-4">{tip.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.section>
          )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
};

export default USAT;

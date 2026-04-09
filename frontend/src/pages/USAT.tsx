import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown, Clock3, FileCheck2, PenSquare, Sigma, Sparkles, Target } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, Subject, USATCategory } from "@/services/api";

const CATEGORY_CARD_STYLES: Record<string, string> = {
  "USAT-E": "from-sky-100 via-cyan-100 to-blue-100 border-sky-200",
  "USAT-M": "from-emerald-100 via-green-100 to-lime-100 border-emerald-200",
  "USAT-CS": "from-indigo-100 via-blue-100 to-cyan-100 border-indigo-200",
  "USAT-GS": "from-amber-100 via-yellow-100 to-orange-100 border-amber-200",
  "USAT-A": "from-rose-100 via-orange-100 to-amber-100 border-rose-200",
};

const SUBJECT_CARD_STYLES = [
  "from-white to-cyan-50 border-cyan-200",
  "from-white to-emerald-50 border-emerald-200",
  "from-white to-amber-50 border-amber-200",
  "from-white to-indigo-50 border-indigo-200",
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const examInfo = [
  { label: "Verbal Reasoning", marks: "20" },
  { label: "Quantitative Reasoning", marks: "25" },
  { label: "Subject Knowledge", marks: "30" },
  { label: "Essay Writing", marks: "25" },
];

const USAT = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<USATCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("USAT-E");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    (async () => {
      const fetchedCategories = await apiClient.listUSATCategories();
      setCategories(fetchedCategories);
      if (fetchedCategories.length > 0) {
        setSelectedCategory(fetchedCategories[0].code);
      }
    })().catch(() => {
      setCategories([]);
    });
  }, []);

  useEffect(() => {
    if (!selectedCategory) return;
    setLoadingSubjects(true);
    (async () => {
      const fetchedSubjects = await apiClient.listUSATCategorySubjects(selectedCategory);
      setSubjects(fetchedSubjects);
    })()
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [selectedCategory]);

  const selectedMeta = useMemo(
    () => categories.find((category) => category.code === selectedCategory),
    [categories, selectedCategory]
  );

  const openCategory = (categoryCode: string) => {
    setSelectedCategory(categoryCode);
  };

  const openSubject = (subject: Subject) => {
    navigate(`/usat/${selectedCategory}/${slugify(subject.name)}`);
  };

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
                    <Sparkles className="h-3.5 w-3.5" /> USAT Preparation Hub
                  </p>
                  <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Build Your USAT Edge</h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                    Pick your stream, master the right subjects, and practice with focused notes, MCQs, past papers, and exam-tested strategies.
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

          <section className="mb-10">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">USAT Categories</h2>
              <div className="relative min-w-56">
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:border-cyan-400 focus:outline-none"
                >
                  {categories.map((category) => (
                    <option key={category.code} value={category.code}>
                      {category.code} - {category.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <motion.button
                  key={category.code}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => openCategory(category.code)}
                  className={`group rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                    CATEGORY_CARD_STYLES[category.code] || "from-white to-slate-100 border-slate-200"
                  } ${selectedCategory === category.code ? "ring-2 ring-cyan-500" : ""}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex rounded-lg bg-white/70 px-2.5 py-1 text-xs font-bold tracking-wide text-slate-800">
                      {category.code}
                    </span>
                    <BookOpen className="h-4 w-4 text-slate-700 transition-transform group-hover:scale-110" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{category.title}</h3>
                  <p className="mt-1 text-sm text-slate-700">{category.description}</p>
                </motion.button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Subjects for {selectedCategory}</h2>
                <p className="text-sm text-slate-600">{selectedMeta?.description}</p>
              </div>
              <Link to="/admin" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
                Manage Content
              </Link>
            </div>

            {loadingSubjects ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading subjects...</div>
            ) : subjects.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                No subjects found for this category yet. Use Admin panel to add them.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((subject, index) => (
                  <button
                    key={subject.id}
                    onClick={() => openSubject(subject)}
                    className={`group rounded-2xl border bg-gradient-to-br p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                      SUBJECT_CARD_STYLES[index % SUBJECT_CARD_STYLES.length]
                    }`}
                  >
                    <div className="mb-3 inline-flex rounded-xl bg-white p-2 shadow-sm">
                      <Sigma className="h-5 w-5 text-slate-700" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{subject.name}</h3>
                    <p className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-700">
                      Open Subject Plan <FileCheck2 className="h-4 w-4" />
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-gradient-to-r from-cyan-50 via-white to-emerald-50 p-5 shadow-sm">
            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><PenSquare className="h-4 w-4 text-cyan-700" /> USAT Success Pattern</h3>
            <p className="mt-2 text-sm text-slate-700">
              Build a weekly rhythm: 60% concept revision, 30% MCQ drills, 10% time-bound past paper sessions.
            </p>
          </section>
        </div>
      </div>
    </>
  );
};

export default USAT;

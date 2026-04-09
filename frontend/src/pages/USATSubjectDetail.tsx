import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Clock4, Download, FileText, GraduationCap, Lightbulb, ListChecks, ScrollText } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Material, Subject, Tip, Topic } from "@/services/api";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const readYear = (title: string): string => {
  const match = title.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : "N/A";
};

const resolveMaterialLink = (content: string): string | null => {
  if (!content) return null;
  const trimmed = content.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("/uploads/")) return `${window.location.origin}${trimmed}`;
  return null;
};

const USATSubjectDetail = () => {
  const { category = "", subject = "" } = useParams();
  const [subjectInfo, setSubjectInfo] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectMaterials, setSubjectMaterials] = useState<Material[]>([]);
  const [pastPapers, setPastPapers] = useState<Material[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [mcqsByTopic, setMcqsByTopic] = useState<Record<number, MCQ[]>>({});
  const [activeTopicId, setActiveTopicId] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    if (!category || !subject) return;

    (async () => {
      const categorySubjects = await apiClient.listUSATCategorySubjects(category);
      const matched = categorySubjects.find((item) => slugify(item.name) === subject) || null;
      setSubjectInfo(matched);

      if (!matched) {
        setTopics([]);
        setSubjectMaterials([]);
        setPastPapers([]);
        setTips([]);
        setMcqsByTopic({});
        return;
      }

      const [fetchedTopics, fetchedMaterials, fetchedPastPapers, fetchedTips] = await Promise.all([
        apiClient.listTopics(matched.id),
        apiClient.listSubjectMaterials(matched.id),
        apiClient.listSubjectPastPapers(matched.id),
        apiClient.listSubjectTips(matched.id),
      ]);

      setTopics(fetchedTopics);
      setSubjectMaterials(fetchedMaterials);
      setPastPapers(fetchedPastPapers);
      setTips(fetchedTips);

      const topicMcqPairs = await Promise.all(
        fetchedTopics.map(async (topicItem) => [topicItem.id, await apiClient.listMCQs(topicItem.id)] as const)
      );
      const byTopic = Object.fromEntries(topicMcqPairs);
      setMcqsByTopic(byTopic);
      setActiveTopicId(fetchedTopics[0]?.id ?? null);
    })().catch(() => {
      setSubjectInfo(null);
      setTopics([]);
      setSubjectMaterials([]);
      setPastPapers([]);
      setTips([]);
      setMcqsByTopic({});
      setActiveTopicId(null);
    });
  }, [category, subject]);

  const activeTopic = useMemo(
    () => topics.find((topicItem) => topicItem.id === activeTopicId) || topics[0] || null,
    [topics, activeTopicId]
  );
  const activeMcqs = activeTopic ? mcqsByTopic[activeTopic.id] || [] : [];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white pt-24 pb-14">
        <div className="container mx-auto px-4">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-3xl border border-slate-200 bg-gradient-to-r from-white via-cyan-50 to-sky-50 p-6 shadow-sm">
            <Link to="/usat" className="text-sm font-medium text-cyan-700 hover:underline">← Back to USAT Categories</Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">{subjectInfo?.name || "Subject"}</h1>
            <p className="mt-1 text-sm text-slate-600">{category} Track • Structured preparation map with MCQs, notes, papers, and strategy guidance.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm"><span className="font-semibold text-slate-800">Topics:</span> {topics.length}</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm"><span className="font-semibold text-slate-800">Notes:</span> {subjectMaterials.length}</div>
              <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sm"><span className="font-semibold text-slate-800">Past Papers:</span> {pastPapers.length}</div>
            </div>
          </motion.section>

          <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 inline-flex items-center gap-2 text-xl font-semibold text-slate-900"><BookOpen className="h-5 w-5 text-cyan-700" /> Topics + MCQs</h2>
              {topics.length === 0 ? (
                <p className="text-sm text-slate-500">No topics available for this subject yet.</p>
              ) : (
                <div className="space-y-3">
                  {topics.map((topicItem) => (
                    <div key={topicItem.id} className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-cyan-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-slate-900">{topicItem.title}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveTopicId(topicItem.id)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Practice MCQs
                          </button>
                          <button
                            onClick={() => setActiveTopicId(topicItem.id)}
                            className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100"
                          >
                            View Notes
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><ListChecks className="h-4 w-4 text-cyan-700" /> MCQ Practice: {activeTopic?.title || "Select topic"}</h3>
                {activeMcqs.length === 0 ? (
                  <p className="text-sm text-slate-500">No MCQs available for this topic yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activeMcqs.slice(0, 6).map((mcq, index) => (
                      <div key={mcq.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-semibold text-slate-900">Q{index + 1}. {mcq.question}</p>
                        <div className="mt-2 grid gap-1 text-sm text-slate-700">
                          <p>A. {mcq.option_a}</p>
                          <p>B. {mcq.option_b}</p>
                          <p>C. {mcq.option_c}</p>
                          <p>D. {mcq.option_d}</p>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-emerald-700">Correct: {mcq.correct_answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><FileText className="h-5 w-5 text-cyan-700" /> Notes / PDFs</h2>
                {subjectMaterials.length === 0 ? (
                  <p className="text-sm text-slate-500">No notes uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {subjectMaterials.map((material) => {
                      const href = resolveMaterialLink(material.content);
                      return (
                        <div key={material.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-sm font-semibold text-slate-900">{material.title}</p>
                          {href ? (
                            <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline" href={href} target="_blank" rel="noreferrer">
                              View / Download <Download className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <p className="mt-1 text-xs text-slate-600 line-clamp-3">{material.content}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><ScrollText className="h-5 w-5 text-amber-700" /> Past Papers</h2>
                {pastPapers.length === 0 ? (
                  <p className="text-sm text-slate-500">No past papers uploaded yet.</p>
                ) : (
                  <div className="grid gap-2">
                    {pastPapers.map((paper) => {
                      const href = resolveMaterialLink(paper.content);
                      return (
                        <div key={paper.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                          <p className="text-sm font-semibold text-slate-900">{paper.title}</p>
                          <p className="mt-1 text-xs text-slate-600">Year: {readYear(paper.title)}</p>
                          {href && (
                            <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline" href={href} target="_blank" rel="noreferrer">
                              Open Paper <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-emerald-50 p-5 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-slate-900"><Lightbulb className="h-5 w-5 text-emerald-700" /> Tips & Tricks</h2>
            {tips.length === 0 ? (
              <p className="text-sm text-slate-500">No tips added yet. Ask admin to publish strategy tips for this subject.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {tips.map((tip) => (
                  <div key={tip.id} className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{tip.title}</p>
                    <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{tip.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 inline-flex items-center gap-2">
              <Clock4 className="h-4 w-4" />
              Rule of 3: Revise concept, solve timed MCQs, then review mistakes in one loop.
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <p className="inline-flex items-center gap-1"><GraduationCap className="h-4 w-4 text-cyan-700" /> Need to upload or manage content? Use the <Link className="font-semibold text-cyan-700 hover:underline" to="/admin">Admin Studio</Link>.</p>
          </section>
        </div>
      </div>
    </>
  );
};

export default USATSubjectDetail;

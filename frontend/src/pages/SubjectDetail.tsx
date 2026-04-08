import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, FileText, Layers } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Material, Subject, Topic } from "@/services/api";

const SubjectDetail = () => {
  const { subjectId } = useParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materialsByTopic, setMaterialsByTopic] = useState<Record<number, Material[]>>({});
  const [mcqsByTopic, setMcqsByTopic] = useState<Record<number, MCQ[]>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const id = Number(subjectId);
    if (!id || Number.isNaN(id)) return;

    (async () => {
      const subjects = await apiClient.listSubjects();
      const matchedSubject = subjects.find((item) => item.id === id) || null;
      setSubject(matchedSubject);

      if (!matchedSubject) {
        setTopics([]);
        setMaterialsByTopic({});
        setMcqsByTopic({});
        return;
      }

      const fetchedTopics = await apiClient.listTopics(id);
      setTopics(fetchedTopics);

      const materialPairs = await Promise.all(
        fetchedTopics.map(async (topic) => [topic.id, await apiClient.listMaterials(topic.id)] as const)
      );
      const mcqPairs = await Promise.all(
        fetchedTopics.map(async (topic) => [topic.id, await apiClient.listMCQs(topic.id)] as const)
      );

      setMaterialsByTopic(Object.fromEntries(materialPairs));
      setMcqsByTopic(Object.fromEntries(mcqPairs));
    })().catch(() => {
      setSubject(null);
      setTopics([]);
      setMaterialsByTopic({});
      setMcqsByTopic({});
    });
  }, [subjectId]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-12 bg-gradient-to-br from-cyan-50 via-sky-50 to-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/subjects" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-cyan-700 mb-6 font-medium transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Subjects
            </Link>

            <h1 className="font-heading text-3xl font-bold text-gray-900 mb-2">{subject?.name || "Subject"}</h1>
            <p className="text-gray-600 mb-8">Exam Type: {subject?.exam_type || "-"}</p>

            {topics.length === 0 ? (
              <div className="rounded-2xl border bg-white p-6 text-gray-600">No topics available for this subject.</div>
            ) : (
              <div className="space-y-5">
                {topics.map((topic) => {
                  const materials = materialsByTopic[topic.id] || [];
                  const mcqs = mcqsByTopic[topic.id] || [];

                  return (
                    <div key={topic.id} className="bg-white rounded-2xl p-6 shadow border border-cyan-100">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="h-4 w-4 text-cyan-700" />
                        <h2 className="font-semibold text-lg">{topic.title}</h2>
                      </div>

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-medium text-sm mb-2 flex items-center gap-1"><Layers className="h-4 w-4" /> Materials</h3>
                          {materials.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No materials yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {materials.map((material) => (
                                <div key={material.id} className="rounded-lg border p-3 bg-slate-50">
                                  <p className="font-medium text-sm">{material.title}</p>
                                  <p className="text-xs text-muted-foreground uppercase">{material.type}</p>
                                  <p className="text-sm mt-1 whitespace-pre-wrap">{material.content}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <h3 className="font-medium text-sm mb-2 flex items-center gap-1"><FileText className="h-4 w-4" /> MCQs</h3>
                          {mcqs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No MCQs yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {mcqs.map((mcq) => (
                                <div key={mcq.id} className="rounded-lg border p-3 bg-slate-50">
                                  <p className="font-medium text-sm mb-1">{mcq.question}</p>
                                  <p className="text-xs">A. {mcq.option_a}</p>
                                  <p className="text-xs">B. {mcq.option_b}</p>
                                  <p className="text-xs">C. {mcq.option_c}</p>
                                  <p className="text-xs">D. {mcq.option_d}</p>
                                  <p className="text-xs mt-2 text-emerald-700 font-semibold">Correct: {mcq.correct_answer}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{mcq.explanation}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SubjectDetail;

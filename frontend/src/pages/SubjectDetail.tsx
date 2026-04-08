import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, ExternalLink, FileText, Layers, Pencil, Trash2, Upload } from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, MCQ, Material, Subject, Topic } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SubjectDetail = () => {
  const { toast } = useToast();
  const { subjectId } = useParams();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [materialsByTopic, setMaterialsByTopic] = useState<Record<number, Material[]>>({});
  const [mcqsByTopic, setMcqsByTopic] = useState<Record<number, MCQ[]>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [mcqDialogOpen, setMcqDialogOpen] = useState(false);

  const [subjectForm, setSubjectForm] = useState({ name: "", examType: "" });
  const [topicForm, setTopicForm] = useState({ id: 0, title: "", subjectId: 0, mode: "create" as "create" | "edit" });
  const [materialForm, setMaterialForm] = useState({
    id: 0,
    title: "",
    content: "",
    type: "notes" as "notes" | "past_paper",
    topicId: 0,
    mode: "create" as "create" | "edit",
  });
  const [mcqForm, setMcqForm] = useState({
    id: 0,
    question: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A" as "A" | "B" | "C" | "D",
    explanation: "",
    topicId: 0,
    mode: "create" as "create" | "edit",
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const loadSubjectData = async () => {
    const id = Number(subjectId);
    if (!id || Number.isNaN(id)) return;

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
  };

  useEffect(() => {
    (async () => {
      if (apiClient.isAuthenticated()) {
        try {
          const me = await apiClient.getCurrentUser();
          setIsAdmin(Boolean(me.is_admin));
        } catch {
          setIsAdmin(false);
        }
      }

      await loadSubjectData();
    })().catch(() => {
      setSubject(null);
      setTopics([]);
      setMaterialsByTopic({});
      setMcqsByTopic({});
    });
  }, [subjectId]);

  const resolveMaterialLink = (content: string): string | null => {
    if (!content) return null;
    const trimmed = content.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("/uploads/")) {
      return `${window.location.origin}${trimmed}`;
    }
    return null;
  };

  const openEditSubject = () => {
    if (!subject) return;
    setSubjectForm({ name: subject.name, examType: subject.exam_type });
    setSubjectDialogOpen(true);
  };

  const submitSubjectEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject) return;
    await apiClient.updateSubject(subject.id, { name: subjectForm.name.trim(), exam_type: subjectForm.examType.trim() });
    setSubjectDialogOpen(false);
    await loadSubjectData();
    toast({ description: "Subject updated" });
  };

  const openAddTopic = () => {
    if (!subject) return;
    setTopicForm({ id: 0, title: "", subjectId: subject.id, mode: "create" });
    setTopicDialogOpen(true);
  };

  const openEditTopic = (topic: Topic) => {
    setTopicForm({ id: topic.id, title: topic.title, subjectId: topic.subject_id, mode: "edit" });
    setTopicDialogOpen(true);
  };

  const submitTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (topicForm.mode === "create") {
      await apiClient.createTopic({ title: topicForm.title.trim(), subject_id: topicForm.subjectId });
      toast({ description: "Topic added" });
    } else {
      await apiClient.updateTopic(topicForm.id, { title: topicForm.title.trim(), subject_id: topicForm.subjectId });
      toast({ description: "Topic updated" });
    }
    setTopicDialogOpen(false);
    await loadSubjectData();
  };

  const removeTopic = async (topicId: number) => {
    if (!confirm("Delete this topic and all its materials/MCQs?")) return;
    await apiClient.deleteTopic(topicId);
    await loadSubjectData();
    toast({ description: "Topic deleted" });
  };

  const openAddMaterial = (topicId: number) => {
    setMaterialForm({ id: 0, title: "", content: "", type: "notes", topicId, mode: "create" });
    setMaterialDialogOpen(true);
  };

  const openEditMaterial = (material: Material) => {
    setMaterialForm({
      id: material.id,
      title: material.title,
      content: material.content,
      type: material.type === "past_paper" ? "past_paper" : "notes",
      topicId: material.topic_id,
      mode: "edit",
    });
    setMaterialDialogOpen(true);
  };

  const submitMaterial = async (e: FormEvent) => {
    e.preventDefault();
    if (materialForm.mode === "create") {
      await apiClient.createMaterial({
        title: materialForm.title.trim(),
        content: materialForm.content,
        type: materialForm.type,
        topic_id: materialForm.topicId,
      });
      toast({ description: "Material added" });
    } else {
      await apiClient.updateMaterial(materialForm.id, {
        title: materialForm.title.trim(),
        content: materialForm.content,
        type: materialForm.type,
        topic_id: materialForm.topicId,
      });
      toast({ description: "Material updated" });
    }
    setMaterialDialogOpen(false);
    await loadSubjectData();
  };

  const removeMaterial = async (materialId: number) => {
    if (!confirm("Delete this material?")) return;
    await apiClient.deleteMaterial(materialId);
    await loadSubjectData();
    toast({ description: "Material deleted" });
  };

  const openAddMCQ = (topicId: number) => {
    setMcqForm({
      id: 0,
      question: "",
      optionA: "",
      optionB: "",
      optionC: "",
      optionD: "",
      correctAnswer: "A",
      explanation: "",
      topicId,
      mode: "create",
    });
    setMcqDialogOpen(true);
  };

  const openEditMCQ = (mcq: MCQ) => {
    setMcqForm({
      id: mcq.id,
      question: mcq.question,
      optionA: mcq.option_a,
      optionB: mcq.option_b,
      optionC: mcq.option_c,
      optionD: mcq.option_d,
      correctAnswer: ["A", "B", "C", "D"].includes(mcq.correct_answer)
        ? (mcq.correct_answer as "A" | "B" | "C" | "D")
        : "A",
      explanation: mcq.explanation,
      topicId: mcq.topic_id,
      mode: "edit",
    });
    setMcqDialogOpen(true);
  };

  const submitMCQ = async (e: FormEvent) => {
    e.preventDefault();
    if (mcqForm.mode === "create") {
      await apiClient.createMCQ({
        question: mcqForm.question,
        option_a: mcqForm.optionA,
        option_b: mcqForm.optionB,
        option_c: mcqForm.optionC,
        option_d: mcqForm.optionD,
        correct_answer: mcqForm.correctAnswer,
        explanation: mcqForm.explanation,
        topic_id: mcqForm.topicId,
      });
      toast({ description: "MCQ added" });
    } else {
      await apiClient.updateMCQ(mcqForm.id, {
        question: mcqForm.question,
        option_a: mcqForm.optionA,
        option_b: mcqForm.optionB,
        option_c: mcqForm.optionC,
        option_d: mcqForm.optionD,
        correct_answer: mcqForm.correctAnswer,
        explanation: mcqForm.explanation,
        topic_id: mcqForm.topicId,
      });
      toast({ description: "MCQ updated" });
    }
    setMcqDialogOpen(false);
    await loadSubjectData();
  };

  const removeMCQ = async (mcqId: number) => {
    if (!confirm("Delete this MCQ?")) return;
    await apiClient.deleteMCQ(mcqId);
    await loadSubjectData();
    toast({ description: "MCQ deleted" });
  };

  const uploadPDFs = async (topicId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    await apiClient.uploadMaterialPDFs(topicId, Array.from(files));
    await loadSubjectData();
    toast({ description: `${files.length} PDF(s) uploaded` });
  };

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

            {isAdmin && subject && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap gap-2">
                <Button onClick={openEditSubject} variant="outline" size="sm" className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit Subject</Button>
                <Button onClick={openAddTopic} variant="outline" size="sm">+ Add Topic</Button>
              </div>
            )}

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
                        {isAdmin && (
                          <div className="ml-auto flex gap-2">
                            <Button onClick={() => openEditTopic(topic)} variant="outline" size="sm" className="inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
                            <Button onClick={() => removeTopic(topic.id)} variant="outline" size="sm" className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100"><Trash2 className="h-3 w-3" /> Delete</Button>
                          </div>
                        )}
                      </div>

                      {isAdmin && (
                        <div className="mb-4 rounded-xl border border-dashed border-slate-300 p-3 flex flex-wrap gap-2">
                          <Button onClick={() => openAddMaterial(topic.id)} variant="outline" size="sm" className="bg-cyan-50 hover:bg-cyan-100">+ Add Material</Button>
                          <Button onClick={() => openAddMCQ(topic.id)} variant="outline" size="sm" className="bg-cyan-50 hover:bg-cyan-100">+ Add MCQ</Button>
                          <label className="text-xs px-3 py-2 rounded bg-cyan-50 border hover:bg-cyan-100 inline-flex items-center gap-1 cursor-pointer">
                            <Upload className="h-3 w-3" /> Upload PDFs
                            <input
                              type="file"
                              accept="application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => uploadPDFs(topic.id, e.target.files)}
                            />
                          </label>
                        </div>
                      )}

                      <div className="grid lg:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-medium text-sm mb-2 flex items-center gap-1"><Layers className="h-4 w-4" /> Materials</h3>
                          {materials.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No materials yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {materials.map((material) => (
                                <div key={material.id} className="rounded-lg border p-3 bg-slate-50">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-sm">{material.title}</p>
                                    {isAdmin && (
                                      <div className="flex gap-1">
                                        <Button onClick={() => openEditMaterial(material)} variant="outline" size="sm">Edit</Button>
                                        <Button onClick={() => removeMaterial(material.id)} variant="outline" size="sm" className="bg-rose-50 hover:bg-rose-100">Delete</Button>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground uppercase">{material.type}</p>
                                  {resolveMaterialLink(material.content) ? (
                                    <a
                                      className="text-sm mt-2 inline-flex items-center gap-1 text-cyan-700 hover:underline"
                                      href={resolveMaterialLink(material.content) as string}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open PDF <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ) : (
                                    <p className="text-sm mt-1 whitespace-pre-wrap">{material.content}</p>
                                  )}
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
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-medium text-sm mb-1">{mcq.question}</p>
                                    {isAdmin && (
                                      <div className="flex gap-1">
                                        <Button onClick={() => openEditMCQ(mcq)} variant="outline" size="sm">Edit</Button>
                                        <Button onClick={() => removeMCQ(mcq.id)} variant="outline" size="sm" className="bg-rose-50 hover:bg-rose-100">Delete</Button>
                                      </div>
                                    )}
                                  </div>
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

      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>Update subject metadata visible to all users.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitSubjectEdit} className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" value={subjectForm.name} onChange={(e) => setSubjectForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Subject name" required />
            <input className="w-full border rounded-lg px-3 py-2" value={subjectForm.examType} onChange={(e) => setSubjectForm((prev) => ({ ...prev, examType: e.target.value }))} placeholder="Exam type" required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{topicForm.mode === "create" ? "Add Topic" : "Edit Topic"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTopic} className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" value={topicForm.title} onChange={(e) => setTopicForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Topic title" required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTopicDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{materialForm.mode === "create" ? "Add Material" : "Edit Material"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMaterial} className="space-y-3">
            <input className="w-full border rounded-lg px-3 py-2" value={materialForm.title} onChange={(e) => setMaterialForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Material title" required />
            <select className="w-full border rounded-lg px-3 py-2" value={materialForm.type} onChange={(e) => setMaterialForm((prev) => ({ ...prev, type: e.target.value as "notes" | "past_paper" }))}>
              <option value="notes">Notes</option>
              <option value="past_paper">Past Paper</option>
            </select>
            <textarea className="w-full border rounded-lg px-3 py-2 min-h-28" value={materialForm.content} onChange={(e) => setMaterialForm((prev) => ({ ...prev, content: e.target.value }))} placeholder="Material content (or PDF link path)" required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={mcqDialogOpen} onOpenChange={setMcqDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mcqForm.mode === "create" ? "Add MCQ" : "Edit MCQ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitMCQ} className="space-y-3">
            <textarea className="w-full border rounded-lg px-3 py-2 min-h-20" value={mcqForm.question} onChange={(e) => setMcqForm((prev) => ({ ...prev, question: e.target.value }))} placeholder="Question" required />
            <input className="w-full border rounded-lg px-3 py-2" value={mcqForm.optionA} onChange={(e) => setMcqForm((prev) => ({ ...prev, optionA: e.target.value }))} placeholder="Option A" required />
            <input className="w-full border rounded-lg px-3 py-2" value={mcqForm.optionB} onChange={(e) => setMcqForm((prev) => ({ ...prev, optionB: e.target.value }))} placeholder="Option B" required />
            <input className="w-full border rounded-lg px-3 py-2" value={mcqForm.optionC} onChange={(e) => setMcqForm((prev) => ({ ...prev, optionC: e.target.value }))} placeholder="Option C" required />
            <input className="w-full border rounded-lg px-3 py-2" value={mcqForm.optionD} onChange={(e) => setMcqForm((prev) => ({ ...prev, optionD: e.target.value }))} placeholder="Option D" required />
            <select className="w-full border rounded-lg px-3 py-2" value={mcqForm.correctAnswer} onChange={(e) => setMcqForm((prev) => ({ ...prev, correctAnswer: e.target.value as "A" | "B" | "C" | "D" }))}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
            <textarea className="w-full border rounded-lg px-3 py-2 min-h-20" value={mcqForm.explanation} onChange={(e) => setMcqForm((prev) => ({ ...prev, explanation: e.target.value }))} placeholder="Explanation" required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMcqDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubjectDetail;

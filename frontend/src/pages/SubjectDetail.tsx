import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle2, Play, FileText, ExternalLink, Download, Lightbulb, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

type Topic = { title: string; subtopics: string[]; completed: boolean };
type Material = { title: string; type: string; source: string; link: string };
type Tip = { title: string; description: string; category: string };

type SubjectData = {
  name: string;
  topics: Topic[];
  materials: Material[];
  tips: Tip[];
};

const topicsMap: Record<string, SubjectData> = {
  english: {
    name: "English",
    topics: [
      { title: "Vocabulary & Word Meanings", subtopics: ["Synonyms & Antonyms", "Contextual Usage", "Word Roots", "One-word Substitutions"], completed: true },
      { title: "Reading Comprehension", subtopics: ["Passage Analysis", "Inference Questions", "Main Idea", "Tone & Purpose"], completed: true },
      { title: "Grammar & Sentence Structure", subtopics: ["Tenses", "Subject-Verb Agreement", "Sentence Correction", "Active/Passive Voice"], completed: false },
      { title: "Verbal Reasoning", subtopics: ["Analogies", "Logical Deduction", "Critical Reasoning", "Paragraph Organization"], completed: false },
      { title: "Punctuation & Usage", subtopics: ["Commas & Semicolons", "Apostrophes", "Common Errors"], completed: false },
    ],
    materials: [
      { title: "Complete Vocabulary Guide", type: "PDF", source: "PrepNest", link: "#" },
      { title: "Grammar Rules Cheat Sheet", type: "PDF", source: "PrepNest", link: "#" },
      { title: "Reading Comprehension Strategies", type: "Video", source: "YouTube", link: "#" },
      { title: "Common English Mistakes to Avoid", type: "Article", source: "GrammarlyBlog", link: "#" },
      { title: "SAT-Style Vocabulary Flashcards", type: "Flashcards", source: "Quizlet", link: "#" },
      { title: "USAT English 2024", type: "Past Paper", source: "Official", link: "#" },
      { title: "USAT English 2023", type: "Past Paper", source: "Official", link: "#" },
      { title: "HAT English 2024", type: "Past Paper", source: "Official", link: "#" },
      { title: "HAT English 2023", type: "Past Paper", source: "Official", link: "#" },
    ],
    tips: [
      { title: "Read the question before the passage", description: "Skim the questions first so you know what to look for while reading. This saves time and improves accuracy.", category: "Strategy" },
      { title: "Eliminate wrong answers first", description: "In MCQs, cross out obviously wrong options to increase your chance of picking the right one.", category: "Exam Tip" },
      { title: "Learn 10 new words daily", description: "Consistent vocabulary building beats last-minute cramming. Use flashcards and spaced repetition.", category: "Preparation" },
      { title: "Watch for tone keywords", description: "Words like 'however', 'despite', 'although' signal contrast — critical for comprehension questions.", category: "Strategy" },
      { title: "Practice timed reading", description: "Set a timer for passages to build speed without sacrificing understanding.", category: "Preparation" },
    ],
  },
  mathematics: {
    name: "Mathematics",
    topics: [
      { title: "Algebra", subtopics: ["Linear Equations", "Quadratic Equations", "Polynomials", "Inequalities", "Functions"], completed: true },
      { title: "Arithmetic", subtopics: ["Percentages", "Ratios", "Averages", "Profit & Loss", "Simple & Compound Interest"], completed: false },
      { title: "Geometry", subtopics: ["Triangles", "Circles", "Coordinate Geometry", "Area & Volume"], completed: false },
      { title: "Trigonometry", subtopics: ["Basic Identities", "Heights & Distances", "Trigonometric Equations"], completed: false },
      { title: "Statistics & Probability", subtopics: ["Mean, Median, Mode", "Basic Probability", "Data Interpretation"], completed: false },
      { title: "Sets & Logic", subtopics: ["Set Operations", "Venn Diagrams", "Logical Statements"], completed: false },
    ],
    materials: [
      { title: "Algebra Formula Sheet", type: "PDF", source: "PrepNest", link: "#" },
      { title: "Geometry Visualizer", type: "Interactive", source: "GeoGebra", link: "#" },
      { title: "Trigonometry Made Easy", type: "Video", source: "Khan Academy", link: "#" },
      { title: "Probability Crash Course", type: "Video", source: "YouTube", link: "#" },
      { title: "Practice Problem Sets", type: "PDF", source: "PrepNest", link: "#" },
      { title: "Mental Math Techniques", type: "Article", source: "MathIsFun", link: "#" },
      { title: "USAT Mathematics 2024", type: "Past Paper", source: "Official", link: "#" },
      { title: "USAT Mathematics 2023", type: "Past Paper", source: "Official", link: "#" },
      { title: "HAT Mathematics 2024", type: "Past Paper", source: "Official", link: "#" },
      { title: "HAT Mathematics 2023", type: "Past Paper", source: "Official", link: "#" },
    ],
    tips: [
      { title: "Memorize key formulas", description: "Create a formula sheet and review it daily. Focus on quadratic formula, trig identities, and area/volume formulas.", category: "Preparation" },
      { title: "Work backwards from answers", description: "In MCQs, plug answer choices into the equation to quickly find the correct one.", category: "Exam Tip" },
      { title: "Draw diagrams for geometry", description: "Always sketch the problem. Visual representation makes relationships between shapes much clearer.", category: "Strategy" },
      { title: "Estimate before calculating", description: "Round numbers mentally first to get an approximate answer, then eliminate far-off options.", category: "Exam Tip" },
      { title: "Practice mental math daily", description: "Speed in basic calculations gives you more time for complex problems during the exam.", category: "Preparation" },
      { title: "Identify the pattern first", description: "Most sequence and series questions follow a recognizable pattern — spot it before computing.", category: "Strategy" },
    ],
  },
};

const defaultData: SubjectData = {
  name: "Subject",
  topics: [
    { title: "Introduction & Basics", subtopics: ["Overview", "Key Concepts", "Terminology"], completed: true },
    { title: "Core Concepts", subtopics: ["Fundamentals", "Applications", "Problem Solving"], completed: false },
    { title: "Advanced Topics", subtopics: ["Analysis", "Critical Thinking", "Practice"], completed: false },
  ],
  materials: [
    { title: "Study Guide", type: "PDF", source: "PrepNest", link: "#" },
    { title: "Video Lectures", type: "Video", source: "YouTube", link: "#" },
    { title: "Past Paper 2024", type: "Past Paper", source: "Official", link: "#" },
  ],
  tips: [
    { title: "Start with the basics", description: "Build a strong foundation before tackling advanced topics.", category: "Preparation" },
    { title: "Review mistakes carefully", description: "Understanding why you got a question wrong is more valuable than doing new questions.", category: "Strategy" },
  ],
};

const tabs = ["Topics", "Materials", "Tips & Tricks"] as const;
type Tab = typeof tabs[number];

const SubjectDetail = () => {
  const { subjectId } = useParams();
  const data = topicsMap[subjectId || ""] || defaultData;
  const [activeTab, setActiveTab] = useState<Tab>("Topics");

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/subjects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
              <ArrowLeft className="h-4 w-4" /> Back to Subjects
            </Link>
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">{data.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8">
              <span>{data.topics.length} topics</span>
              <span>·</span>
              <span>{data.materials.length} resources</span>
              <span>·</span>
              <span>{data.tips.length} tips</span>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-8 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Topics Tab */}
            {activeTab === "Topics" && (
              <div className="space-y-4">
                {data.topics.map((topic, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-card rounded-xl p-5 shadow-card"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${topic.completed ? "bg-success/10" : "bg-secondary"}`}>
                        {topic.completed ? <CheckCircle2 className="h-4 w-4 text-success" /> : <BookOpen className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <h3 className="font-heading font-semibold text-foreground flex-1">{topic.title}</h3>
                      <Button size="sm" variant={topic.completed ? "outline" : "default"} className={!topic.completed ? "gradient-primary text-primary-foreground border-0" : ""}>
                        {topic.completed ? "Review" : "Start"} <Play className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-11">
                      {topic.subtopics.map((st, j) => (
                        <span key={j} className="text-xs px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">{st}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Materials Tab (includes past papers) */}
            {activeTab === "Materials" && (
              <div className="space-y-3">
                {data.materials.map((mat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-card rounded-xl p-5 shadow-card flex items-center gap-4"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      mat.type === "Past Paper" ? "bg-warning/10" : "bg-primary/10"
                    }`}>
                      {mat.type === "Video" ? <Play className="h-5 w-5 text-primary" /> :
                       mat.type === "Past Paper" ? <FileText className="h-5 w-5 text-warning" /> :
                       mat.type === "PDF" ? <FileText className="h-5 w-5 text-primary" /> :
                       mat.type === "Interactive" ? <Layers className="h-5 w-5 text-primary" /> :
                       <BookOpen className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground text-sm">{mat.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          mat.type === "Past Paper" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"
                        }`}>{mat.type}</span>
                        <span className="text-xs text-muted-foreground">from {mat.source}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1 flex-shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Tips & Tricks Tab */}
            {activeTab === "Tips & Tricks" && (
              <div className="space-y-3">
                {data.tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="bg-card rounded-xl p-5 shadow-card"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lightbulb className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-heading font-semibold text-foreground text-sm">{tip.title}</h4>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{tip.category}</span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{tip.description}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default SubjectDetail;

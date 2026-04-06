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
      <div className="min-h-screen pt-24 pb-12 bg-gradient-to-br from-purple-50/50 via-blue-50/50 to-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Link to="/subjects" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-purple-600 mb-6 font-medium transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Subjects
            </Link>
            <h1 className="font-heading text-4xl font-bold text-gray-900 mb-3">{data.name}</h1>
            <div className="flex flex-wrap gap-3 text-sm mb-8">
              <span className="px-3 py-1.5 bg-purple-100 text-purple-700 font-semibold rounded-full border border-purple-200">
                {data.topics.length} topics
              </span>
              <span className="px-3 py-1.5 bg-blue-100 text-blue-700 font-semibold rounded-full border border-blue-200">
                {data.materials.length} resources
              </span>
              <span className="px-3 py-1.5 bg-orange-100 text-orange-700 font-semibold rounded-full border border-orange-200">
                {data.tips.length} tips
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1.5 bg-gray-100 rounded-xl mb-8 overflow-x-auto border border-gray-200">
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-5 py-3 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
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
                    className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-purple-300"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${
                        topic.completed 
                          ? "bg-gradient-to-br from-green-400 to-green-500" 
                          : "bg-gradient-to-br from-gray-200 to-gray-300"
                      }`}>
                        {topic.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        ) : (
                          <BookOpen className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <h3 className="font-heading font-bold text-gray-800 flex-1">{topic.title}</h3>
                      <Button size="sm" variant={topic.completed ? "outline" : "gradient"}>
                        {topic.completed ? "Review" : "Start"} <Play className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-13">
                      {topic.subtopics.map((st, j) => (
                        <span 
                          key={j} 
                          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200 hover:from-purple-200 hover:to-blue-200 transition-colors cursor-pointer"
                        >
                          {st}
                        </span>
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
                    className="bg-white rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-4 border border-gray-200 hover:border-blue-300"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${
                      mat.type === "Past Paper" 
                        ? "bg-gradient-to-br from-orange-400 to-orange-500" 
                        : mat.type === "Video"
                        ? "bg-gradient-to-br from-red-400 to-red-500"
                        : mat.type === "PDF"
                        ? "bg-gradient-to-br from-blue-400 to-blue-500"
                        : mat.type === "Interactive"
                        ? "bg-gradient-to-br from-purple-400 to-purple-500"
                        : "bg-gradient-to-br from-teal-400 to-teal-500"
                    }`}>
                      {mat.type === "Video" ? <Play className="h-6 w-6 text-white" /> :
                       mat.type === "Past Paper" ? <FileText className="h-6 w-6 text-white" /> :
                       mat.type === "PDF" ? <FileText className="h-6 w-6 text-white" /> :
                       mat.type === "Interactive" ? <Layers className="h-6 w-6 text-white" /> :
                       <BookOpen className="h-6 w-6 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-800 text-sm mb-1.5">{mat.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                          mat.type === "Past Paper" 
                            ? "bg-orange-100 text-orange-700 border border-orange-300" 
                            : mat.type === "Video"
                            ? "bg-red-100 text-red-700 border border-red-300"
                            : mat.type === "PDF"
                            ? "bg-blue-100 text-blue-700 border border-blue-300"
                            : mat.type === "Interactive"
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-teal-100 text-teal-700 border border-teal-300"
                        }`}>{mat.type}</span>
                        <span className="text-xs text-gray-600 font-medium">from {mat.source}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0 border-2 hover:border-blue-500 hover:text-blue-600">
                      <ExternalLink className="h-4 w-4" /> Open
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
                    className="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200 hover:border-yellow-300"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center flex-shrink-0 shadow-md">
                        <Lightbulb className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-heading font-bold text-gray-800 text-sm">{tip.title}</h4>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            tip.category === "Strategy" 
                              ? "bg-blue-100 text-blue-700 border border-blue-300"
                              : tip.category === "Exam Tip"
                              ? "bg-purple-100 text-purple-700 border border-purple-300"
                              : "bg-green-100 text-green-700 border border-green-300"
                          }`}>{tip.category}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{tip.description}</p>
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

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles, BookOpen, Calculator, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";

type Message = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  { label: "Explain a concept", prompt: "Explain Newton's laws of motion in simple terms", icon: BookOpen },
  { label: "Solve math problem", prompt: "Solve step by step: If 2x² + 3x - 5 = 0, find x", icon: Calculator },
  { label: "Evaluate my essay", prompt: "Please evaluate my essay on the importance of education in modern society", icon: FileText },
];

const AITutor = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm your AI Tutor for USAT & HAT preparation. 🎓\n\nI can help you with:\n- **Concept explanations** for any subject\n- **Step-by-step math solutions**\n- **Essay evaluation** with detailed feedback\n- **Practice tips** and study strategies\n\nWhat would you like to learn today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Temporary local response used while backend integration is in progress.
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Thanks for the question. The AI service is still being connected to this interface.\n\nSoon, this tutor will provide:\n- Detailed concept explanations\n- Step-by-step math solutions\n- Essay feedback\n- Curated study guidance"
      }]);
      setLoading(false);
    }, 1500);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen pt-16 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="container mx-auto max-w-3xl space-y-4">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "gradient-primary text-primary-foreground rounded-br-sm"
                      : "bg-card shadow-card text-foreground rounded-bl-sm"
                  }`}>
                    {msg.content.split(/(\*\*.*?\*\*)/).map((part, j) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={j}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="bg-card shadow-card rounded-2xl rounded-bl-sm px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {messages.length <= 1 && (
          <div className="container mx-auto max-w-3xl px-4 pb-3">
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qp.prompt)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-card shadow-card text-sm text-foreground hover:shadow-card-hover transition-shadow"
                >
                  <qp.icon className="h-4 w-4 text-primary" />
                  {qp.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border bg-card p-4">
          <div className="container mx-auto max-w-3xl">
            <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask me anything about USAT or HAT..."
                className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
              <Button type="submit" disabled={!input.trim() || loading} variant="gradient" className="rounded-xl px-4">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AITutor;

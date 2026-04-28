import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, User, Loader2, Copy, Check, AlertCircle, Menu, X, Upload,
  Paperclip, Sparkles, Lock, MessageSquare, Clock, Zap, Brain,
  Globe, Database, GraduationCap, Plus, Search, BookOpen, Calculator,
  PenTool,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import Navbar from "@/components/Navbar";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import { useIsMobile } from "@/hooks/use-mobile";

/* ═══════════════════════ TYPES & CONSTANTS ═══════════════════════ */

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  usedAgents?: string[];
  references?: Array<{ title: string; url?: string; relevance?: number }>;
  visuals?: Array<{ type: string; data: string }>;
  attachments?: Array<{ type: string; name: string; data: string }>;
  timestamp?: number;
}

interface ServerConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string | null;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "Hey there! \uD83D\uDC4B I\u2019m your **PrepNest AI Tutor** \u2014 your personal companion for **USAT & HAT** exam prep.\n\n" +
    "I can explain concepts, solve problems, analyze documents, and fetch live data. Just ask me anything!",
  timestamp: Date.now(),
};

function makeWelcome(name?: string): Message {
  const greeting = name ? `Hey **${name}**! \uD83D\uDC4B` : "Hey there! \uD83D\uDC4B";
  return {
    role: "assistant",
    content:
      `${greeting} I\u2019m your **PrepNest AI Tutor** \u2014 your personal learning companion for **USAT & HAT** exam prep.\n\n` +
      "Ask me anything \u2014 I\u2019ll explain concepts, solve problems step-by-step, analyze your documents, quiz you with MCQs, and more!",
    timestamp: Date.now(),
  };
}

const QUICK_PROMPTS = [
  { label: "Explain a concept", prompt: "Explain photosynthesis in simple terms with real-world examples", icon: BookOpen, gradient: "from-violet-500 to-purple-500", border: "border-violet-200 dark:border-violet-800", hover: "hover:border-violet-400" },
  { label: "Solve a math problem", prompt: "Solve step by step: If 3x\u00B2 + 12x - 15 = 0, find all values of x", icon: Calculator, gradient: "from-blue-500 to-cyan-500", border: "border-blue-200 dark:border-blue-800", hover: "hover:border-blue-400" },
  { label: "Practice MCQ", prompt: "Give me a challenging MCQ about the solar system and explain the answer", icon: GraduationCap, gradient: "from-emerald-500 to-teal-500", border: "border-emerald-200 dark:border-emerald-800", hover: "hover:border-emerald-400" },
  { label: "Essay feedback", prompt: "Give me tips on writing a strong argumentative essay for USAT", icon: PenTool, gradient: "from-rose-500 to-pink-500", border: "border-rose-200 dark:border-rose-800", hover: "hover:border-rose-400" },
];

/* ═══════════════════════ MARKDOWN RENDERER ═══════════════════════ */

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trimStart().startsWith("``" + "`")) {
      const lang = line.trimStart().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("``" + "`")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      elements.push(
        <div key={elements.length} className="my-3 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700">
          {lang && (
            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{lang}
            </div>
          )}
          <pre className="bg-slate-50 dark:bg-slate-900 px-4 py-3 overflow-x-auto text-[12px] leading-relaxed text-slate-800 dark:text-slate-200 font-mono"><code>{codeLines.join("\n")}</code></pre>
        </div>
      );
      continue;
    }
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={elements.length} className="border-l-3 border-violet-400 bg-violet-50/50 dark:bg-violet-950/20 pl-3 py-1.5 my-1.5 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-[13px]">
          {inlineMarkdown(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }
    if (line.startsWith("### ")) {
      elements.push(<h3 key={elements.length} className="text-[13px] font-bold mt-3 mb-1 text-slate-800 dark:text-slate-200">{inlineMarkdown(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={elements.length} className="text-sm font-bold mt-3.5 mb-1.5 text-slate-900 dark:text-slate-100">{inlineMarkdown(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={elements.length} className="text-base font-extrabold mt-3.5 mb-1.5 bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">{inlineMarkdown(line.slice(2))}</h1>);
      i++; continue;
    }

    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      elements.push(
        <div key={elements.length} className="flex gap-2 ml-0.5 my-0.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-[9px] font-bold text-white mt-0.5">{olMatch[1]}</span>
          <span className="text-slate-700 dark:text-slate-300 text-[13px] leading-relaxed">{inlineMarkdown(olMatch[2])}</span>
        </div>
      );
      i++; continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={elements.length} className="flex gap-2 ml-0.5 my-0.5">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-violet-400 to-blue-400" />
          <span className="text-slate-700 dark:text-slate-300 text-[13px] leading-relaxed">{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
      i++; continue;
    }
    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={elements.length} className="my-3 border-slate-200 dark:border-slate-700" />);
      i++; continue;
    }
    if (line.trim() === "") { elements.push(<div key={elements.length} className="h-1.5" />); i++; continue; }

    elements.push(<p key={elements.length} className="leading-relaxed text-slate-700 dark:text-slate-300 my-0.5 text-[13px]">{inlineMarkdown(line)}</p>);
    i++;
  }
  return elements;
}

function inlineMarkdown(text: string): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const m = match[0];
    if (m.startsWith("**")) {
      parts.push(<strong key={`b-${match.index}`} className="font-semibold text-slate-900 dark:text-white">{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("`")) {
      parts.push(<code key={`c-${match.index}`} className="px-1 py-0.5 rounded bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[12px] font-mono border border-violet-200/60 dark:border-violet-700/60">{m.slice(1, -1)}</code>);
    } else if (m.startsWith("*")) {
      parts.push(<em key={`i-${match.index}`} className="italic text-slate-600 dark:text-slate-400">{m.slice(1, -1)}</em>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ═══════════════════════ SSE PARSER ═══════════════════════ */

function parseSSEChunk(
  chunk: Uint8Array,
  onToken: (t: string) => void,
  onDone: (meta: Record<string, unknown>) => void,
  onError?: (msg: string) => void,
) {
  const text = new TextDecoder().decode(chunk);
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const raw = line.slice(6).trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === "token") onToken(parsed.value);
      else if (parsed.type === "done") onDone(parsed);
      else if (parsed.type === "error" && onError) onError(parsed.message);
    } catch { /* skip malformed */ }
  }
}

/* ═══════════════════════ AGENT BADGE ═══════════════════════ */

function getAgentInfo(name: string): { label: string; icon: typeof Brain; color: string } {
  const clean = name.replace("_agent", "").replace("_", " ");
  const map: Record<string, { label: string; icon: typeof Brain; color: string }> = {
    router: { label: "Router", icon: Zap, color: "from-amber-400 to-orange-500" },
    memory: { label: "Memory", icon: Brain, color: "from-purple-400 to-violet-500" },
    retriever: { label: "Knowledge", icon: Database, color: "from-blue-400 to-cyan-500" },
    live_data: { label: "Live Data", icon: Globe, color: "from-emerald-400 to-teal-500" },
    tutor: { label: "Tutor", icon: GraduationCap, color: "from-rose-400 to-pink-500" },
    visualization: { label: "Visual", icon: Sparkles, color: "from-violet-400 to-purple-500" },
  };
  return map[clean] || { label: clean, icon: Zap, color: "from-slate-400 to-slate-500" };
}

/* ═══════════════════════ AI AVATAR (SVG) ═══════════════════════ */

const AiAvatar = ({ size = 32 }: { size?: number }) => (
  <div
    className="shrink-0 rounded-full shadow-lg shadow-violet-500/25 flex items-center justify-center"
    style={{ width: size, height: size, background: "linear-gradient(135deg, #7c3aed, #3b82f6, #06b6d4)" }}
  >
    <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z" fill="white" fillOpacity="0.95"/>
      <circle cx="12" cy="12" r="4" fill="white" fillOpacity="0.3"/>
    </svg>
  </div>
);

/* ══════════════════════════ MAIN COMPONENT ══════════════════════════ */

const AITutor = () => {
  const { toast } = useToast();

  const [userName, setUserName] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [serverConversations, setServerConversations] = useState<ServerConversation[]>([]);
  const [attachments, setAttachments] = useState<Array<{ type: string; name: string; data: string }>>([]);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    apiClient.checkIsPro().then(setIsPro).catch(() => setIsPro(false));
    // Load user profile for personalization
    if (apiClient.getToken()) {
      apiClient.getCurrentUser().then((profile) => {
        const firstName = profile.full_name?.split(" ")[0] || "";
        setUserName(firstName);
        setIsPro(profile.is_pro || profile.is_admin);
        // Personalize welcome message
        setMessages(prev => {
          if (prev.length === 1 && prev[0] === WELCOME_MESSAGE) {
            return [makeWelcome(firstName)];
          }
          return prev;
        });
      }).catch(() => {});
    }
    loadConversationList();
  }, []);

  const loadConversationList = async () => {
    if (!apiClient.getToken?.()) return;
    try {
      setLoadingHistory(true);
      const convos = await apiClient.listConversations();
      setServerConversations(convos);
    } catch { /* silently fail */ } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (messages.length > 1 && loading) setTimeout(() => scrollToBottom("auto"), 10);
  }, [messages, loading, scrollToBottom]);

  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + "px";
    }
  }, [input]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return serverConversations;
    const q = searchQuery.toLowerCase();
    return serverConversations.filter(c => c.title.toLowerCase().includes(q));
  }, [serverConversations, searchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { toast({ title: "File too large", description: "Max 10MB", variant: "destructive" }); continue; }
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const data = ev.target?.result as string;
          setAttachments(prev => [...prev, { type: file.type, name: file.name, data }]);
        };
        reader.readAsDataURL(file);
      } else { toast({ title: "Invalid file", description: "PDF or images only", variant: "destructive" }); }
    }
    e.currentTarget.value = "";
  };

  const newConversation = () => {
    setMessages([makeWelcome(userName)]);
    setConversationId(null);
    setAttachments([]);
    setError(null);
    setDailyLimitReached(false);
    if (isMobile) setSidebarOpen(false);
  };

  const loadServerConversation = async (conv: ServerConversation) => {
    try {
      const detail = await apiClient.getConversation(conv.id);
      const msgs: Message[] = [
        makeWelcome(userName),
        ...detail.messages.map((m: any) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          usedAgents: m.metadata?.used_agents || undefined,
          references: m.metadata?.references || undefined,
          visuals: m.metadata?.visuals || undefined,
          timestamp: new Date(m.created_at).getTime(),
        })),
      ];
      setMessages(msgs);
      setConversationId(conv.id);
      setAttachments([]);
      setError(null);
      if (isMobile) setSidebarOpen(false);
      setTimeout(() => scrollToBottom("auto"), 100);
    } catch { toast({ title: "Error", description: "Could not load conversation", variant: "destructive" }); }
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  /* ── Send Message (always uses chatStream) ── */
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!apiClient.getToken?.()) { setAuthDialogOpen(true); return; }

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      attachments: attachments.length ? attachments : undefined,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setError(null);
    setLoading(true);

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true, timestamp: Date.now() }]);
    scrollToBottom("auto");

    try {
      const stream = await apiClient.chatStream(
        text.trim(),
        conversationId || undefined,
        "intermediate",
        attachments.length ? attachments : undefined,
      );

      const reader = stream.getReader();
      let fullContent = "";
      let metadata: Record<string, unknown> = {};
      let streamError = "";
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushTokens = () => {
        flushTimer = null;
        setMessages(prev => {
          const updated = [...prev];
          if (updated[assistantIdx]) updated[assistantIdx] = { ...updated[assistantIdx], content: fullContent, streaming: true };
          return updated;
        });
        scrollToBottom("auto");
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          parseSSEChunk(
            value,
            (token) => {
              fullContent += token;
              if (!flushTimer) flushTimer = setTimeout(flushTokens, 30);
            },
            (meta) => {
              metadata = meta;
              if (meta.conversation_id) setConversationId(meta.conversation_id as string);
            },
            (errMsg) => { streamError = errMsg; },
          );
        }
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flushTokens();
      } finally { reader.releaseLock(); }

      if (streamError) {
        setError(streamError);
        toast({ title: "AI Error", description: streamError, variant: "destructive" });
      }

      setMessages(prev => {
        const updated = [...prev];
        if (updated[assistantIdx]) {
          const finalContent = fullContent || (streamError ? "Sorry, I encountered an error. Please try again." : "");
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            content: finalContent,
            streaming: false,
            usedAgents: (metadata.used_agents as string[]) || undefined,
            references: (metadata.references as Message["references"]) || undefined,
            visuals: (metadata.visuals as Message["visuals"]) || undefined,
          };
        }
        return updated;
      });

      loadConversationList();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get response";
      if (msg.includes("messages per day") || msg.includes("Upgrade to Pro")) {
        setDailyLimitReached(true);
      }
      setError(msg);
      setMessages(prev => prev.slice(0, -1));
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      scrollToBottom("auto");
    }
  };

  /* ══════════════════════ RENDER ══════════════════════ */

  return (
    <>
      <Navbar />
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} message="Please log in to chat with your AI Tutor." />

      <div className="min-h-screen pt-16 flex bg-slate-50 dark:bg-slate-950">

        {isMobile && sidebarOpen && (
          <button aria-label="Close sidebar" className="fixed inset-0 top-16 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ══ SIDEBAR ══ */}
        <motion.aside
          initial={false}
          animate={{ x: sidebarOpen ? 0 : -280 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="w-[260px] flex flex-col overflow-hidden fixed left-0 top-16 h-[calc(100vh-64px)] z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200/80 dark:border-slate-800"
        >
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <button
              onClick={newConversation}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              New conversation
            </button>
          </div>

          <div className="px-3 pt-2 pb-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-[11px] rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400/50 transition" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {loadingHistory ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Loader2 className="h-4 w-4 text-violet-400 animate-spin mb-1.5" />
                <p className="text-[10px] text-slate-400">Loading...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="h-5 w-5 text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-[10px] text-slate-400">No conversations yet</p>
              </div>
            ) : (
              filteredConversations.map(conv => (
                <button key={conv.id} onClick={() => loadServerConversation(conv)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-all ${
                    conv.id === conversationId
                      ? "bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-200 font-medium"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <div className="truncate">{conv.title || "New Chat"}</div>
                  <div className="flex items-center gap-1 mt-0.5 text-[9px] text-slate-400">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(conv.updated_at || conv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 px-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${isPro ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {isPro ? "Pro \u2022 Unlimited" : "Free \u2022 5 msgs/day"}
              </span>
            </div>
          </div>
        </motion.aside>

        {/* ══ MAIN ══ */}
        <div
          className="flex-1 flex flex-col"
          style={{ marginLeft: !isMobile && sidebarOpen ? 260 : 0, transition: "margin-left 0.3s ease" }}
        >
          {/* Header */}
          <div className="border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-3 py-2 flex items-center justify-between sticky top-16 z-20">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <AiAvatar size={28} />
              <div>
                <h1 className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-none">PrepNest AI</h1>
                <p className="text-[9px] text-slate-400 mt-0.5">USAT & HAT Tutor</p>
              </div>
            </div>
            <div className="w-7" />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto pb-28">
            <div className="mx-auto max-w-2xl px-3 sm:px-4 py-4 space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 150, damping: 18 }}
                    className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && <AiAvatar size={28} />}

                    <div className="flex flex-col gap-1 max-w-[88%] sm:max-w-[80%]">
                      <div className={`rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-600 to-blue-600 text-white rounded-br-sm shadow-sm"
                          : "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 rounded-bl-sm border border-slate-200/80 dark:border-slate-700/80"
                      }`}>
                        {msg.role === "assistant" && msg.streaming && !msg.content ? (
                          <div className="flex items-center gap-1 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        ) : (
                          <>
                            {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                            {msg.streaming && msg.role === "assistant" && (
                              <span className="inline-block w-[3px] h-4 ml-0.5 rounded-sm bg-violet-500 animate-pulse align-middle" />
                            )}
                          </>
                        )}
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-0.5">
                          {msg.attachments.map((att, j) => (
                            <div key={j} className="flex items-center gap-1 px-2 py-0.5 bg-violet-50 dark:bg-violet-900/30 rounded text-[10px] text-violet-600 dark:text-violet-300 border border-violet-200/60 dark:border-violet-700/60">
                              <Paperclip className="h-2.5 w-2.5" />{att.name}
                            </div>
                          ))}
                        </div>
                      )}

                      {msg.role === "assistant" && !msg.streaming && msg.content && (msg.usedAgents?.length || msg.references?.length) && (
                        <div className="space-y-1 px-0.5">
                          {msg.usedAgents && msg.usedAgents.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              {msg.usedAgents.map((a, j) => {
                                const info = getAgentInfo(a);
                                return (
                                  <span key={j} className={`inline-flex items-center gap-0.5 px-1.5 py-px rounded-full text-[9px] font-semibold text-white bg-gradient-to-r ${info.color}`}>
                                    <info.icon className="h-2 w-2" />{info.label}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {msg.references && msg.references.length > 0 && (
                            <div className="space-y-0.5">
                              {msg.references.slice(0, 3).map((ref, j) => (
                                <div key={j} className="text-[10px] text-slate-400 flex items-start gap-1">
                                  <span className="text-violet-400">\u2022</span>
                                  {typeof ref === "string" ? ref : (ref.url ? <a href={ref.url} target="_blank" rel="noopener noreferrer" className="hover:text-violet-500 underline decoration-dotted">{ref.title}</a> : ref.title)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.role === "assistant" && msg.content && !msg.streaming && (
                        <button onClick={() => copyToClipboard(msg.content, i)}
                          className="w-fit flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-500 transition-colors px-1 py-0.5 rounded">
                          {copiedIndex === i ? <><Check className="h-2.5 w-2.5 text-emerald-500" />Copied</> : <><Copy className="h-2.5 w-2.5" />Copy</>}
                        </button>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 mt-0.5">
                        <User className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && messages.length > 0 && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                  <AiAvatar size={28} />
                  <div className="bg-white dark:bg-slate-800/90 rounded-2xl rounded-bl-sm px-3.5 py-2.5 border border-slate-200/80 dark:border-slate-700/80">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 items-start">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-rose-600 dark:text-rose-400">{error}</p>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick prompts (only on empty chat) */}
          {messages.length <= 1 && !loading && (
            <div className="mx-auto max-w-2xl px-3 sm:px-4 pb-4 w-full">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {QUICK_PROMPTS.map((qp, i) => (
                  <button key={i} onClick={() => sendMessage(qp.prompt)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800/60 border ${qp.border} text-left transition-all hover:shadow-sm hover:-translate-y-0.5 ${qp.hover}`}>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${qp.gradient} shadow-sm`}>
                      <qp.icon className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight">{qp.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ INPUT ══ */}
          <div
            className="fixed bottom-0 right-0 border-t border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-3 py-1.5 z-10"
            style={{ left: !isMobile && sidebarOpen ? 260 : 0, transition: "left 0.3s ease" }}
          >
            <div className="mx-auto max-w-2xl space-y-1">

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 rounded-md text-[10px] text-violet-700 dark:text-violet-300">
                      <Paperclip className="h-2.5 w-2.5" />
                      <span className="max-w-[100px] truncate">{att.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="hover:text-rose-500"><X className="h-2.5 w-2.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {dailyLimitReached && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
                  <Lock className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">Daily limit reached \u2014 upgrade to Pro for unlimited.</p>
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-1 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*,.pdf" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading || dailyLimitReached}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 transition hover:text-violet-500 hover:border-violet-300 disabled:opacity-40">
                  <Upload className="h-3 w-3" />
                </button>
                <div className="flex-1">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder={dailyLimitReached ? "Daily limit reached" : "Ask me anything..."}
                    disabled={loading || dailyLimitReached}
                    rows={1}
                    className="w-full min-h-[32px] max-h-[100px] resize-none rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-violet-400/50 focus:border-violet-400 transition disabled:opacity-50"
                  />
                </div>
                <button type="submit" disabled={!input.trim() || loading || dailyLimitReached}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dailyLimitReached ? <Lock className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
                </button>
              </form>

              <p className="text-center text-[8px] text-slate-400 leading-none">AI can make mistakes. Verify important info.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AITutor;

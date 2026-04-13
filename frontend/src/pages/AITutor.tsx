import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, User, BookOpen, Calculator, FileText, Loader2,
  Copy, Check, AlertCircle, Menu, X, Upload, Paperclip, Sparkles,
  Trash2, GraduationCap, Lightbulb, PenTool,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import Navbar from "@/components/Navbar";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "prepnest_conversations";
const CURRENT_CHAT_KEY = "prepnest_current_chat";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  usedAgents?: string[];
  references?: Array<{ title: string; url?: string; relevance?: number }>;
  visuals?: Array<{ type: string; data: string }>;
  attachments?: Array<{ type: string; name: string; data: string }>;
}

interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
}

type AiMode = "chat" | "explain" | "solve-mcq" | "solve-math" | "solve-essay";

const AI_MODES: Array<{ value: AiMode; label: string; icon: typeof BookOpen; desc: string }> = [
  { value: "chat", label: "Chat", icon: Sparkles, desc: "General Q&A" },
  { value: "explain", label: "Explain", icon: Lightbulb, desc: "Deep explanations" },
  { value: "solve-mcq", label: "MCQ", icon: GraduationCap, desc: "Solve MCQs" },
  { value: "solve-math", label: "Math", icon: Calculator, desc: "Step-by-step math" },
  { value: "solve-essay", label: "Essay", icon: PenTool, desc: "Essay feedback" },
];

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content:
    "# Welcome to PrepNest AI Tutor! \ud83c\udf93\n\n" +
    "I'm your intelligent study companion for **USAT & HAT exam preparation**.\n\n" +
    "## What I Can Do\n" +
    "- **Explain Concepts** \u2014 Break down any topic with clear examples\n" +
    "- **Solve Problems** \u2014 Step-by-step math, MCQ reasoning, essay feedback\n" +
    "- **Analyze Documents** \u2014 Upload PDFs or images for detailed explanations\n" +
    "- **Personalized Help** \u2014 Adapt to your level and learning style\n\n" +
    "Pick a mode below and **ask me anything!**",
};

const quickPrompts = [
  {
    label: "Explain a concept",
    prompt: "Explain the water cycle in simple, clear terms with examples",
    icon: BookOpen,
    color: "border-violet-200 hover:border-violet-400 hover:bg-violet-50/60",
    iconBg: "bg-violet-100 text-violet-600",
  },
  {
    label: "Solve math problem",
    prompt: "Solve step by step: If 2x + 5 = 13, what is x?",
    icon: Calculator,
    color: "border-cyan-200 hover:border-cyan-400 hover:bg-cyan-50/60",
    iconBg: "bg-cyan-100 text-cyan-600",
  },
  {
    label: "Evaluate my essay",
    prompt: "Provide constructive feedback on my essay about environmental conservation",
    icon: FileText,
    color: "border-fuchsia-200 hover:border-fuchsia-400 hover:bg-fuchsia-50/60",
    iconBg: "bg-fuchsia-100 text-fuchsia-600",
  },
];

/* -- Markdown renderer ------------------------------------------------- */

function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code blocks
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
        <div key={elements.length} className="my-3 rounded-xl overflow-hidden border border-slate-200">
          {lang && (
            <div className="bg-slate-100 px-4 py-1.5 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200">
              {lang}
            </div>
          )}
          <pre className="bg-slate-50 px-4 py-3 overflow-x-auto text-[13px] leading-relaxed text-slate-800 font-mono">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(<h3 key={elements.length} className="text-base font-bold mt-4 mb-1.5 text-slate-800">{inlineMarkdown(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={elements.length} className="text-lg font-bold mt-5 mb-2 text-slate-900">{inlineMarkdown(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={elements.length} className="text-xl font-extrabold mt-5 mb-2 text-slate-900">{inlineMarkdown(line.slice(2))}</h1>);
      i++; continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (olMatch) {
      elements.push(
        <div key={elements.length} className="flex gap-2.5 ml-1 my-0.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600 mt-0.5">{olMatch[1]}</span>
          <span className="text-slate-700 leading-relaxed">{inlineMarkdown(olMatch[2])}</span>
        </div>
      );
      i++; continue;
    }

    // Unordered list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={elements.length} className="flex gap-2.5 ml-1 my-0.5">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
          <span className="text-slate-700 leading-relaxed">{inlineMarkdown(line.slice(2))}</span>
        </div>
      );
      i++; continue;
    }

    // Empty
    if (line.trim() === "") { elements.push(<div key={elements.length} className="h-2" />); i++; continue; }

    // Paragraph
    elements.push(<p key={elements.length} className="leading-relaxed text-slate-700 my-0.5">{inlineMarkdown(line)}</p>);
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
      parts.push(<strong key={`b-${match.index}`} className="font-bold text-slate-900">{m.slice(2, -2)}</strong>);
    } else if (m.startsWith("`")) {
      parts.push(<code key={`c-${match.index}`} className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 text-[13px] font-mono border border-violet-100">{m.slice(1, -1)}</code>);
    } else if (m.startsWith("*")) {
      parts.push(<em key={`i-${match.index}`} className="italic">{m.slice(1, -1)}</em>);
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* -- SSE parser -------------------------------------------------------- */

function parseSSEChunk(
  chunk: Uint8Array,
  onToken: (t: string) => void,
  onDone: (meta: Record<string, unknown>) => void,
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
    } catch { /* skip */ }
  }
}

/* ====================================================================== */

const AITutor = () => {
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [attachments, setAttachments] = useState<Array<{ type: string; name: string; data: string }>>([]);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [aiMode, setAiMode] = useState<AiMode>("chat");
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const shouldScrollAfterRestoreRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior, block: "end" }), 50);
  }, []);

  /* -- Persist / restore -- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setConversations(JSON.parse(saved));
      const current = localStorage.getItem(CURRENT_CHAT_KEY);
      if (current) { setMessages(JSON.parse(current)); shouldScrollAfterRestoreRef.current = true; }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (shouldScrollAfterRestoreRef.current && messages.length > 0) {
      requestAnimationFrame(() => setTimeout(() => scrollToBottom("auto"), 0));
      shouldScrollAfterRestoreRef.current = false;
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 1 && loading) setTimeout(() => scrollToBottom("auto"), 10);
  }, [messages, loading, scrollToBottom]);

  // Debounced localStorage write for current chat (avoids I/O thrashing during streaming)
  useEffect(() => {
    const timer = setTimeout(() => {
      try { localStorage.setItem(CURRENT_CHAT_KEY, JSON.stringify(messages)); } catch { /* */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations)); } catch { /* */ }
  }, [conversations]);

  useEffect(() => { setSidebarOpen(!isMobile); }, [isMobile]);

  /* -- Auto-resize textarea -- */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  /* -- Sidebar conversations -- */
  const visibleConversations = useMemo(() => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (!userMsgs.length) return conversations;
    const live: Conversation = {
      id: conversationId || "current-chat",
      title: userMsgs[0].content.substring(0, 50) || "Current Chat",
      timestamp: Date.now(),
      messages,
    };
    return [live, ...conversations.filter(c => c.id !== live.id)];
  }, [messages, conversations, conversationId]);

  /* -- File upload -- */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const data = ev.target?.result as string;
          setAttachments(prev => [...prev, { type: file.type, name: file.name, data }]);
          toast({ description: `${file.name} attached` });
        };
        reader.readAsDataURL(file);
      } else {
        toast({ title: "Invalid file", description: "Please upload PDF or image files only", variant: "destructive" });
      }
    }
    e.currentTarget.value = "";
  };

  /* -- Conversation management -- */
  const saveCurrentConversation = useCallback(() => {
    const userMsgs = messages.filter(m => m.role === "user");
    if (userMsgs.length === 0) return;
    const conv: Conversation = {
      id: conversationId || `conv-${Date.now()}`,
      title: userMsgs[0].content.substring(0, 50),
      timestamp: Date.now(),
      messages,
    };
    setConversations(prev => [conv, ...prev.filter(c => c.id !== conv.id)].slice(0, 50));
  }, [messages, conversationId]);

  const newConversation = () => {
    if (messages.length > 1) saveCurrentConversation();
    setMessages([WELCOME_MESSAGE]);
    setConversationId(null);
    setAttachments([]);
    if (isMobile) setSidebarOpen(false);
  };

  const loadConversation = (conv: Conversation) => {
    if (messages.length > 1 && conversationId !== conv.id) saveCurrentConversation();
    setMessages(conv.messages || []);
    setConversationId(conv.id);
    setAttachments([]);
    if (isMobile) setSidebarOpen(false);
  };

  const deleteConversation = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== conv.id));
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  /* -- Send message (always streams) -- */
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!apiClient.getToken?.()) { setAuthDialogOpen(true); return; }

    const userMessage: Message = { role: "user", content: text.trim(), attachments: attachments.length ? attachments : undefined };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setError(null);
    setLoading(true);

    const assistantIdx = messages.length + 1;
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);
    scrollToBottom("auto");

    try {
      let stream: ReadableStream<Uint8Array>;

      if (attachments.length > 0) {
        stream = await apiClient.chatStream(text.trim(), conversationId || undefined, "intermediate", attachments);
      } else {
        if (aiMode === "explain") stream = await apiClient.aiExplainStream(text.trim(), true);
        else if (aiMode === "solve-math") stream = await apiClient.aiSolveStream(text.trim(), "math", true);
        else if (aiMode === "solve-essay") stream = await apiClient.aiSolveStream(text.trim(), "essay", true);
        else if (aiMode === "solve-mcq") stream = await apiClient.aiSolveStream(text.trim(), "mcq", true);
        else stream = await apiClient.aiChatStream(text.trim(), true);
      }

      const reader = stream.getReader();
      let fullContent = "";
      let metadata: Record<string, unknown> = {};

      // Batch token rendering: accumulate tokens and flush to React state periodically
      let tokenBuffer = "";
      let flushScheduled = false;

      const flushTokens = () => {
        if (!tokenBuffer) return;
        const buffered = tokenBuffer;
        tokenBuffer = "";
        flushScheduled = false;
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
              tokenBuffer += token;
              if (!flushScheduled) {
                flushScheduled = true;
                setTimeout(flushTokens, 80);
              }
            },
            (meta) => {
              metadata = meta;
              if (meta.conversation_id) setConversationId(meta.conversation_id as string);
            },
          );
        }
        // Flush any remaining tokens
        flushTokens();
      } finally { reader.releaseLock(); }

      setMessages(prev => {
        const updated = [...prev];
        if (updated[assistantIdx]) {
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            content: fullContent || updated[assistantIdx].content,
            streaming: false,
            usedAgents: (metadata.used_agents as string[]) || undefined,
            references: (metadata.references as Message["references"]) || undefined,
            visuals: (metadata.visuals as Message["visuals"]) || undefined,
          };
        }
        return updated;
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to get response";
      setError(msg);
      setMessages(prev => prev.slice(0, -1));
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
      scrollToBottom("auto");
    }
  };

  /* ======================== RENDER ======================== */
  return (
    <>
      <Navbar />
      <AuthRequiredDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} message="Please log in first to use AI Tutor actions." />

      <div className="min-h-screen pt-16 flex bg-[#f8f7ff]">
        {isMobile && sidebarOpen && (
          <button aria-label="Close" className="fixed inset-0 top-16 z-30 bg-black/30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        )}

        {/* -- SIDEBAR -- */}
        <motion.aside
          initial={false}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          className="w-[272px] flex flex-col overflow-hidden fixed left-0 top-16 h-[calc(100vh-64px)] z-40"
          style={{ background: "white", borderRight: "0.5px solid #e2e0f0", boxShadow: "2px 0 12px rgba(139,92,246,0.06)" }}
        >
          <div className="p-4 border-b border-violet-100 bg-gradient-to-b from-violet-50/50 to-white">
            <button onClick={newConversation}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-300/40 transition-all hover:from-violet-500 hover:to-fuchsia-500 hover:-translate-y-0.5 hover:shadow-xl">
              <Sparkles className="h-4 w-4" /> New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {visibleConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-10 w-10 rounded-2xl bg-violet-100 flex items-center justify-center mb-3">
                  <Bot className="h-5 w-5 text-violet-400" />
                </div>
                <p className="text-xs text-slate-400 font-medium">No chats yet</p>
                <p className="text-[10px] text-slate-300 mt-0.5">Start a conversation above</p>
              </div>
            ) : (
              visibleConversations.map(conv => (
                <motion.div key={conv.id} whileHover={{ x: 3 }} className="group relative">
                  <button onClick={() => loadConversation(conv)} title={conv.title}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all truncate border ${
                      conv.id === (conversationId || "current-chat") && conv.messages === messages
                        ? "bg-violet-50 border-violet-200 text-violet-800"
                        : "bg-slate-50 border-slate-100 text-slate-600 hover:bg-violet-50/60 hover:border-violet-200 hover:text-violet-700"
                    }`}>
                    {conv.id === (conversationId || "current-chat") && conv.messages === messages ? `\u25cf ${conv.title}` : conv.title}
                  </button>
                  <button onClick={(e) => deleteConversation(conv, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-rose-100 rounded-lg text-rose-400">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.aside>

        {/* -- MAIN -- */}
        <div className="flex-1 flex flex-col pb-48 sm:pb-44" style={{ marginLeft: !isMobile && sidebarOpen ? 272 : 0, transition: "margin-left 0.3s ease" }}>
          {/* header */}
          <div className="border-b border-violet-100 bg-white/80 backdrop-blur-md px-4 py-3 flex items-center justify-between shadow-sm shadow-violet-100/30 sticky top-16 z-20">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-violet-50 rounded-xl transition-colors text-slate-500 hover:text-violet-600">
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-200">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">AI Tutor</h1>
                <p className="text-[10px] text-slate-400 mt-0.5">USAT & HAT Preparation</p>
              </div>
            </div>
            <div className="w-9" />
          </div>

          {/* messages */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-3xl px-3 sm:px-4 py-6 space-y-5">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 120, damping: 14 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>

                    {msg.role === "assistant" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-200 mt-1">
                        <Bot className="h-4 w-4 text-white" />
                      </motion.div>
                    )}

                    <div className="flex flex-col gap-2 max-w-[90%] sm:max-w-[82%]">
                      <div className={`rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-br-sm shadow-violet-200"
                          : "bg-white text-slate-800 rounded-bl-sm border border-violet-100/80 shadow-violet-100/40"
                      }`}>
                        {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                        {msg.streaming && msg.role === "assistant" && (
                          <span className="inline-block w-2 h-4 ml-1 rounded-sm bg-violet-400 opacity-70 animate-pulse" />
                        )}
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5 px-1">
                          {msg.attachments.map((att, j) => (
                            <div key={j} className="flex items-center gap-1 px-2 py-1 bg-violet-50 rounded-lg text-xs text-violet-600 border border-violet-200">
                              <Paperclip className="h-3 w-3" />{att.name}
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {msg.role === "assistant" && !msg.streaming && (msg.usedAgents?.length || msg.references?.length) && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-slate-400 space-y-1.5 px-1">
                          {msg.usedAgents && msg.usedAgents.length > 0 && (
                            <div className="flex flex-wrap gap-1 items-center">
                              <span className="font-semibold text-slate-500">Agents:</span>
                              {msg.usedAgents.map((a, j) => (
                                <span key={j} className="px-2 py-0.5 bg-violet-50 text-violet-600 border border-violet-200 rounded-full text-[10px] font-semibold">
                                  {a.replace("_agent", "")}
                                </span>
                              ))}
                            </div>
                          )}
                          {msg.references && msg.references.length > 0 && (
                            <div>
                              <span className="font-semibold text-slate-500">References:</span>
                              <ul className="mt-1 space-y-0.5">
                                {msg.references.slice(0, 3).map((ref, j) => (
                                  <li key={j} className="text-[10px] text-slate-400">{"\u2022"} {typeof ref === "string" ? ref : ref.title || "Source"}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {msg.role === "assistant" && msg.content && !msg.streaming && (
                        <button onClick={() => copyToClipboard(msg.content, i)}
                          className="w-fit flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-violet-600 transition-colors px-2 py-1 rounded-lg hover:bg-violet-50">
                          {copiedIndex === i ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIndex === i ? "Copied!" : "Copy"}
                        </button>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 border border-violet-200 mt-1">
                        <User className="h-4 w-4 text-violet-500" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && !messages[messages.length - 1]?.content && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-200">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-3.5 border border-violet-100 shadow-sm flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-violet-400 animate-spin" />
                    <span className="text-xs text-slate-400 font-medium">Thinking...</span>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-1" />
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-sm text-rose-700">{error}</div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* quick prompts */}
          {messages.length <= 1 && !loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="container mx-auto max-w-3xl px-3 sm:px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickPrompts.map((qp, i) => (
                  <motion.button key={i}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => sendMessage(qp.prompt)}
                    className={`card-hover flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border transition-all text-left shadow-sm hover:shadow-md ${qp.color}`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${qp.iconBg}`}>
                      <qp.icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-slate-700">{qp.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* -- INPUT -- */}
          <div className="fixed bottom-0 right-0 border-t border-violet-100 bg-white/90 backdrop-blur-xl p-3 sm:p-4 shadow-lg shadow-violet-100/30 z-10"
            style={{ left: !isMobile && sidebarOpen ? 272 : 0, transition: "left 0.3s ease" }}>
            <div className="container mx-auto max-w-3xl space-y-3">
              {/* mode chips */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {AI_MODES.map(m => {
                  const active = aiMode === m.value;
                  return (
                    <button key={m.value} onClick={() => setAiMode(m.value)} disabled={loading}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                        active
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-md shadow-violet-200"
                          : "bg-slate-50 text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50"
                      } disabled:opacity-50`}>
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {attachments.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 pb-2 border-b border-violet-100">
                  {attachments.map((att, idx) => (
                    <motion.div key={idx} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-xl text-xs font-medium text-violet-700">
                      <Paperclip className="h-3 w-3" />
                      <span className="max-w-[120px] truncate">{att.name}</span>
                      <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                        className="ml-1 hover:text-rose-500 transition-colors"><X className="h-3 w-3" /></button>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-2 items-end">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} multiple accept="image/*,.pdf" className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-500 transition hover:bg-violet-100 hover:text-violet-700 disabled:opacity-40">
                  <Upload className="h-4 w-4" />
                </button>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Ask me anything about USAT or HAT preparation..."
                  disabled={loading}
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-[160px] resize-none rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition disabled:opacity-50"
                />
                <button type="submit" disabled={!input.trim() || loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-300/40 transition hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AITutor;

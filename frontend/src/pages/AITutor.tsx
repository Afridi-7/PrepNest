import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, BookOpen, Calculator, FileText, Loader2, Copy, Check, AlertCircle, Menu, X, Upload, Paperclip, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import Navbar from "@/components/Navbar";
import AuthRequiredDialog from "@/components/AuthRequiredDialog";
import { useIsMobile } from "@/hooks/use-mobile";

// localStorage key for persisting conversations
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

interface QuickPrompt {
  label: string;
  prompt: string;
  icon: typeof BookOpen;
}

const quickPrompts: QuickPrompt[] = [
  {
    label: "Explain a concept",
    prompt: "Explain the water cycle in simple, clear terms with examples",
    icon: BookOpen,
  },
  {
    label: "Solve math problem",
    prompt: "Solve step by step: If 2x + 5 = 13, what is x?",
    icon: Calculator,
  },
  {
    label: "Evaluate my essay",
    prompt: "Provide constructive feedback on my essay about environmental conservation",
    icon: FileText,
  },
];

const AITutor = () => {
  const { toast } = useToast();
  
  // Initialize state from localStorage
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "# Welcome to PrepNest AI Tutor! 🎓\n\nI'm your intelligent study companion designed specifically for **USAT & HAT preparation**.\n\n## How I Can Help:\n- **📚 Concept Explanations** - Break down complex topics step-by-step\n- **🧮 Math Problem Solving** - Work through equations and calculations\n- **✍️ Essay Feedback** - Review and improve your writing\n- **📊 Practice Tips** - Get personalized study strategies\n- **📄 Document Analysis** - Upload PDFs and images for detailed explanations\n\n**What would you like to learn today?**",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [attachments, setAttachments] = useState<Array<{ type: string; name: string; data: string }>>([]);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldScrollAfterRestoreRef = useRef(false);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    if (messagesEndRef.current) {
      // Use scrollIntoView which is more reliable
      messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
      // Also try the container scroll as fallback
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
        }
      }, 50);
    }
  };

  // Load conversations from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
      }
      const currentChat = localStorage.getItem(CURRENT_CHAT_KEY);
      if (currentChat) {
        const parsed = JSON.parse(currentChat);
        setMessages(parsed);
        shouldScrollAfterRestoreRef.current = true;
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  }, []);

  // Auto-scroll on restore
  useEffect(() => {
    if (shouldScrollAfterRestoreRef.current && messages.length > 0) {
      // Wait for DOM to render then scroll to bottom
      requestAnimationFrame(() => {
        setTimeout(() => scrollToBottom("auto"), 0);
      });
      shouldScrollAfterRestoreRef.current = false;
    }
  }, [messages]);

  // Scroll to bottom when messages change during streaming
  useEffect(() => {
    if (messages.length > 1 && loading) {
      // Small delay to ensure DOM is updated
      const timer = setTimeout(() => scrollToBottom("auto"), 10);
      return () => clearTimeout(timer);
    }
  }, [messages, loading]);

  // Save current chat to localStorage whenever messages change
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_CHAT_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save current chat:", e);
    }
  }, [messages]);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch (e) {
      console.error("Failed to save conversations:", e);
    }
  }, [conversations]);

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const visibleConversations = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === "user");
    const hasLiveConversation = userMessages.length > 0;

    if (!hasLiveConversation) {
      return conversations;
    }

    const liveConversation: Conversation = {
      id: conversationId || "current-chat",
      title: userMessages[0].content.substring(0, 50) || "Current Chat",
      timestamp: Date.now(),
      messages,
    };

    return [liveConversation, ...conversations.filter((c) => c.id !== liveConversation.id)];
  }, [messages, conversations, conversationId]);

  const parseStreamEvents = (
    chunk: Uint8Array,
    onToken: (token: string) => void,
    onComplete: (metadata: any) => void
  ) => {
    const text = new TextDecoder().decode(chunk);
    const lines = text.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6);
      if (!data.trim()) continue;

      try {
        const parsed = JSON.parse(data);

        if (parsed.type === "token") {
          onToken(parsed.value);
        } else if (parsed.type === "done") {
          onComplete({
            conversation_id: parsed.conversation_id,
            used_agents: parsed.used_agents || [],
            references: parsed.references || [],
            visuals: parsed.visuals || [],
          });
        }
      } catch (e) {
        console.error("Failed to parse stream event:", e);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result as string;
          setAttachments((prev) => [...prev, { type: file.type, name: file.name, data }]);
          toast({ description: `${file.name} uploaded successfully` });
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "Invalid file",
          description: "Please upload PDF or image files only",
          variant: "destructive",
        });
      }
    }
  };

  const newConversation = () => {
    // Save current conversation if it has messages
    if (messages.length > 1) {
      const userMessages = messages.filter(m => m.role === "user");
      if (userMessages.length > 0) {
        const title = userMessages[0].content.substring(0, 50) || "New Chat";
        const conv: Conversation = {
          id: conversationId || `conv-${Date.now()}`,
          title: title,
          timestamp: Date.now(),
          messages: messages,
        };
        setConversations((prev) => {
          const updated = [conv, ...prev.filter(c => c.id !== conv.id)];
          return updated.slice(0, 50); // Keep last 50 conversations
        });
      }
    }
    
    // Start new conversation
    setMessages([
      {
        role: "assistant",
        content: "# Welcome to PrepNest AI Tutor! 🎓\n\nI'm your intelligent study companion designed specifically for **USAT & HAT preparation**.\n\n## How I Can Help:\n- **📚 Concept Explanations** - Break down complex topics step-by-step\n- **🧮 Math Problem Solving** - Work through equations and calculations\n- **✍️ Essay Feedback** - Review and improve your writing\n- **📊 Practice Tips** - Get personalized study strategies\n- **📄 Document Analysis** - Upload PDFs and images for detailed explanations\n\n**What would you like to learn today?**",
      },
    ]);
    setConversationId(null);
    setAttachments([]);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const loadConversation = (conv: Conversation) => {
    // Save current conversation first
    if (messages.length > 1 && conversationId !== conv.id) {
      const userMessages = messages.filter(m => m.role === "user");
      if (userMessages.length > 0) {
        const currentConv: Conversation = {
          id: conversationId || `conv-${Date.now()}`,
          title: userMessages[0].content.substring(0, 50),
          timestamp: Date.now(),
          messages: messages,
        };
        setConversations((prev) => 
          [currentConv, ...prev.filter(c => c.id !== currentConv.id)].slice(0, 50)
        );
      }
    }
    
    // Load selected conversation
    setMessages(conv.messages || []);
    setConversationId(conv.id);
    setAttachments([]);
    if (isMobile) {
      setSidebarOpen(false);
    }
    toast({ description: `Loaded: ${conv.title}` });
  };

  const deleteConversation = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter(c => c.id !== conv.id));
    toast({ description: `Deleted: ${conv.title}` });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const token = apiClient.getToken?.();
    if (!token) {
      setAuthDialogOpen(true);
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: text.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);
    setError(null);
    setLoading(true);

    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "", streaming: true }]);
    scrollToBottom("auto");

    try {
      const stream = await apiClient.chatStream(
        text.trim(),
        conversationId || undefined,
        "intermediate",
        attachments.length > 0 ? attachments : undefined
      );
      const reader = stream.getReader();

      let fullContent = "";
      let metadata: any = {};

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          parseStreamEvents(
            value,
            (token) => {
              fullContent += token;
              setMessages((prev) => {
                const updated = [...prev];
                if (updated[assistantIndex]) {
                  updated[assistantIndex] = {
                    ...updated[assistantIndex],
                    content: fullContent,
                    streaming: true,
                  };
                }
                return updated;
              });
              scrollToBottom("auto");
            },
            (meta) => {
              metadata = meta;
              setConversationId(meta.conversation_id);
            }
          );
        }
      } finally {
        reader.releaseLock();
      }

      setMessages((prev) => {
        const updated = [...prev];
        if (updated[assistantIndex]) {
          updated[assistantIndex] = {
            ...updated[assistantIndex],
            streaming: false,
            usedAgents: metadata.used_agents,
            references: metadata.references,
            visuals: metadata.visuals,
          };
        }
        return updated;
      });
      scrollToBottom("auto");
    } catch (err: any) {
      const errorMsg = err.message || "Failed to get response from AI Tutor";
      setError(errorMsg);
      setMessages((prev) => prev.slice(0, -1));
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      scrollToBottom("auto");
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderMessageContent = (content: string) => {
    const renderTextWithMarkdown = (text: string) => {
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;

      // Replace **bold** with <strong>
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let boldMatch;
      const boldMatches: Array<{ text: string; replacement: JSX.Element; index: number }> = [];

      while ((boldMatch = boldRegex.exec(text)) !== null) {
        boldMatches.push({
          text: boldMatch[0],
          replacement: <strong key={`bold-${boldMatch.index}`}>{boldMatch[1]}</strong>,
          index: boldMatch.index,
        });
      }

      // Apply bold replacements
      if (boldMatches.length > 0) {
        lastIndex = 0;
        for (const match of boldMatches) {
          if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
          }
          parts.push(match.replacement);
          lastIndex = match.index + match.text.length;
        }
        if (lastIndex < text.length) {
          parts.push(text.substring(lastIndex));
        }
        return parts;
      }

      return text;
    };

    return content
      .split("\n")
      .map((line, idx) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-base font-semibold mt-3 mb-1 text-foreground">
              {renderTextWithMarkdown(line.slice(4))}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-lg font-bold mt-4 mb-2 text-foreground">
              {renderTextWithMarkdown(line.slice(3))}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={idx} className="text-2xl font-bold mt-4 mb-2 text-foreground">
              {renderTextWithMarkdown(line.slice(2))}
            </h1>
          );
        }
        if (line.startsWith("- ")) {
          return (
            <li key={idx} className="ml-4 list-disc">
              {renderTextWithMarkdown(line.slice(2))}
            </li>
          );
        }
        if (line.startsWith("* ")) {
          return (
            <li key={idx} className="ml-4 list-disc">
              {renderTextWithMarkdown(line.slice(2))}
            </li>
          );
        }
        if (line.trim() === "") {
          return <div key={idx} className="h-2" />;
        }
        return (
          <p key={idx} className="leading-relaxed">
            {renderTextWithMarkdown(line)}
          </p>
        );
      });
  };

  return (
    <>
      <Navbar />
      <AuthRequiredDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        message="Please log in first to use AI Tutor actions."
      />
      <div className="min-h-screen pt-16 flex bg-gradient-to-b from-background to-background/95">
        {isMobile && sidebarOpen && (
          <button
            aria-label="Close conversation panel"
            className="fixed inset-0 top-16 z-30 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Fixed Position */}
        <motion.aside
          initial={false}
          animate={{ x: sidebarOpen ? 0 : -300 }}
          className="w-[280px] flex flex-col bg-card border-r border-border overflow-hidden fixed left-0 top-16 h-[calc(100vh-64px)] z-40 shadow-lg"
        >
          <div className="p-4 border-b border-border bg-card">
            <Button onClick={newConversation} className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
              <Sparkles className="h-4 w-4" />
              <span className="font-semibold">New Chat</span>
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {visibleConversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No previous chats yet</p>
            ) : (
              visibleConversations.map((conv) => (
                <motion.div
                  key={conv.id}
                  whileHover={{ x: 4 }}
                  className="group relative"
                >
                  <button
                    onClick={() => loadConversation(conv)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-secondary/50 transition-all truncate text-foreground bg-secondary/20 border border-border/50 group-hover:border-border"
                    title={conv.title}
                  >
                    {conv.id === (conversationId || "current-chat") && conv.messages === messages ? `Current: ${conv.title}` : conv.title}
                  </button>
                  <button
                    onClick={(e) => deleteConversation(conv, e)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/20 rounded text-destructive hover:text-destructive/80"
                    disabled={conv.id === (conversationId || "current-chat") && conv.messages === messages}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </motion.aside>

        {/* Main Chat Area - Offset for fixed sidebar */}
        <div
          className="flex-1 flex flex-col pb-32"
          style={{
            marginLeft: !isMobile && sidebarOpen ? "280px" : "0px",
            transition: "margin-left 0.3s ease",
          }}
        >
          {/* Header with sidebar toggle */}
          <div className="border-b border-border bg-card/50 backdrop-blur px-4 py-3 flex items-center justify-between shadow-sm">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-secondary rounded-lg transition-colors"
              aria-label={sidebarOpen ? "Hide history" : "Show history"}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold text-foreground">AI Tutor</h1>
            </div>
            <div className="w-9" />
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0">
            <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ type: "spring", stiffness: 100, damping: 10 }}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mt-1 shadow-sm"
                      >
                        <Bot className="h-4 w-4 text-primary-foreground" />
                      </motion.div>
                    )}

                    <div className="flex flex-col gap-2 max-w-[92%] sm:max-w-[85%]">
                      <div
                        className={`rounded-2xl px-3.5 sm:px-4 py-3 text-sm leading-relaxed transition-all ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm shadow-sm"
                            : "bg-card text-foreground rounded-bl-sm border border-border shadow-sm hover:shadow-md"
                        }`}
                      >
                        {msg.role === "assistant" ? renderMessageContent(msg.content) : msg.content}

                        {msg.streaming && msg.role === "assistant" && (
                          <span className="inline-block w-2 h-4 ml-1 bg-current opacity-70 animate-pulse"></span>
                        )}
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-wrap gap-2 px-2"
                        >
                          {msg.attachments.map((att, j) => (
                            <div key={j} className="flex items-center gap-1 px-2 py-1 bg-secondary rounded text-xs text-muted-foreground border border-border">
                              <Paperclip className="h-3 w-3" />
                              {att.name}
                            </div>
                          ))}
                        </motion.div>
                      )}

                      {msg.role === "assistant" && (msg.references?.length || msg.usedAgents?.length) && !msg.streaming && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-muted-foreground space-y-1 px-2"
                        >
                          {msg.usedAgents && msg.usedAgents.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="font-semibold text-foreground">Agents:</span>
                              {msg.usedAgents.map((agent, j) => (
                                <span key={j} className="px-2 py-0.5 bg-secondary rounded-full text-xs border border-border">
                                  {agent.replace("_agent", "")}
                                </span>
                              ))}
                            </div>
                          )}
                          {msg.references && msg.references.length > 0 && (
                            <div>
                              <span className="font-semibold text-foreground">References:</span>
                              <ul className="mt-1 space-y-0.5">
                                {msg.references.slice(0, 3).map((ref, j) => (
                                  <li key={j} className="text-xs text-muted-foreground">
                                    • {typeof ref === "string" ? ref : ref.title || "Source"}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </motion.div>
                      )}

                      {msg.role === "assistant" && msg.content && !msg.streaming && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(msg.content, i)}
                          className="w-fit text-xs h-7"
                        >
                          {copiedIndex === i ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copiedIndex === i ? "Copied" : "Copy"}
                        </Button>
                      )}
                    </div>

                    {msg.role === "user" && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm"
                  >
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </motion.div>
                  <div className="bg-card rounded-2xl rounded-bl-sm px-4 py-3 border border-border shadow-sm flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="flex gap-1"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </motion.div>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-1" />
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="container mx-auto max-w-4xl px-3 sm:px-4 pb-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickPrompts.map((qp, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(qp.prompt)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card hover:bg-secondary border border-border hover:border-primary/50 transition-all text-sm text-foreground text-left shadow-sm hover:shadow-md"
                  >
                    <qp.icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="font-medium">{qp.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Input Area - Fixed at bottom */}
          <div
            className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/80 backdrop-blur p-3 sm:p-4 shadow-lg"
            style={{
              left: !isMobile && sidebarOpen ? "280px" : "0px",
              right: "0px",
              transition: "left 0.3s ease",
            }}
          >
            <div className="container mx-auto max-w-4xl">
              {attachments.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-border"
                >
                  {attachments.map((att, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-2 px-3 py-1 bg-secondary rounded-lg text-sm border border-border"
                    >
                      <Paperclip className="h-3 w-3 text-primary" />
                      <span className="text-foreground">{att.name}</span>
                      <button
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="ml-1 hover:text-destructive transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-2 items-end"
              >
                <div className="flex gap-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="rounded-lg h-10 w-10"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>

                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything about USAT or HAT preparation..."
                  className="flex-1 rounded-xl border border-input bg-background px-3 sm:px-4 py-3 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 transition-all"
                  disabled={loading}
                />
                <Button 
                  type="submit" 
                  disabled={!input.trim() || loading} 
                  className="rounded-xl px-3 sm:px-4 h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AITutor;

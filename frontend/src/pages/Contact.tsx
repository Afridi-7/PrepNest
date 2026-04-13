import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Github, Linkedin, MessageCircle, Twitter, Save, Loader2,
  Pencil, X, User, Camera, ExternalLink, Heart, Sparkles, Send,
  Copy, Check, MapPin, Globe, AlertCircle, RefreshCw, Clock,
  Shield, Users, Phone,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { apiClient, API_ORIGIN, type ContactInfo as ContactInfoType, type ContactInfoUpdate } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

/* ── Skeleton ─────────────────────────────────────────────────────────── */
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-violet-100/60 ${className}`} />
);

const SkeletonPage = () => (
  <div className="container relative mx-auto max-w-4xl px-4">
    <div className="mb-8 rounded-3xl bg-gradient-to-br from-violet-200 via-purple-200 to-fuchsia-200 p-8 sm:p-10">
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
        <Skeleton className="h-28 w-28 sm:h-32 sm:w-32 !rounded-full shrink-0" />
        <div className="flex-1 space-y-3 w-full max-w-sm">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-6 w-20 !rounded-full" />
            <Skeleton className="h-6 w-16 !rounded-full" />
            <Skeleton className="h-6 w-24 !rounded-full" />
          </div>
        </div>
      </div>
    </div>
    <div className="grid md:grid-cols-2 gap-6 mb-8">
      {[0, 1].map(i => (
        <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-11 w-11 shrink-0" />
            <div className="space-y-2 flex-1"><Skeleton className="h-4 w-20" /><Skeleton className="h-3 w-32" /></div>
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
      <Skeleton className="h-5 w-24 mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100">
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="space-y-2 flex-1"><Skeleton className="h-4 w-16" /><Skeleton className="h-3 w-28" /></div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Error state ──────────────────────────────────────────────────────── */
const ErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div className="container relative mx-auto max-w-4xl px-4">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 mb-4">
        <AlertCircle className="h-8 w-8 text-rose-500" />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">Unable to load contact info</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-sm">Something went wrong. Please check your connection and try again.</p>
      <button onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-300/30 hover:shadow-xl transition">
        <RefreshCw className="h-4 w-4" /> Try Again
      </button>
    </motion.div>
  </div>
);

/* ── Stagger variants ─────────────────────────────────────────────────── */
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 16 } },
};

/* ====================================================================== */

const Contact = () => {
  const { toast } = useToast();
  const [info, setInfo] = useState<ContactInfoType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ContactInfoUpdate>({});
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  const fetchData = () => {
    setLoading(true);
    setError(false);
    apiClient.getContactInfo()
      .then((data) => { setInfo(data); setDraft(data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    apiClient.checkIsAdmin().then(setIsAdmin).catch(() => {});
  };

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.updateContactInfo(draft);
      setInfo(updated);
      setEditing(false);
      toast({ description: "Contact info updated!" });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }
    setUploadingImage(true);
    try {
      const updated = await apiClient.uploadContactImage(file);
      setInfo(updated);
      setDraft((prev) => ({ ...prev, image_url: updated.image_url }));
      toast({ description: "Image uploaded!" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally { setUploadingImage(false); e.currentTarget.value = ""; }
  };

  const copyEmail = () => {
    if (info?.email) {
      navigator.clipboard.writeText(info.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const resolveImageUrl = (url: string | null | undefined) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${API_ORIGIN}${url}`;
  };

  const socialLinks = [
    { key: "github_url" as const,   icon: Github,         label: "GitHub",      desc: "Source code & projects",  hoverColor: "hover:border-slate-400 hover:bg-slate-50",   iconBg: "bg-slate-100",  iconColor: "text-slate-600",  accentBar: "from-slate-400 to-slate-500" },
    { key: "linkedin_url" as const,  icon: Linkedin,       label: "LinkedIn",    desc: "Professional profile",    hoverColor: "hover:border-blue-300 hover:bg-blue-50",     iconBg: "bg-blue-100",   iconColor: "text-blue-600",   accentBar: "from-blue-400 to-blue-500" },
    { key: "twitter_url" as const,   icon: Twitter,        label: "Twitter / X", desc: "Updates & insights",      hoverColor: "hover:border-sky-300 hover:bg-sky-50",       iconBg: "bg-sky-100",    iconColor: "text-sky-600",    accentBar: "from-sky-400 to-sky-500" },
    { key: "discord_url" as const,   icon: MessageCircle,  label: "Discord",     desc: "Community & support",     hoverColor: "hover:border-indigo-300 hover:bg-indigo-50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", accentBar: "from-indigo-400 to-indigo-500" },
  ];

  const imageUrl = resolveImageUrl(info?.image_url);
  const updatedAt = info?.updated_at
    ? new Date(info.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <Navbar />
      <div className="relative min-h-screen overflow-hidden bg-[#f8f7ff] pt-20 pb-16">
        {/* ambient blobs (CSS-only for performance) */}
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-16 h-[500px] w-[500px] rounded-full bg-violet-300/20 blur-3xl blob-float-1" />
        <div aria-hidden className="pointer-events-none absolute -right-24 top-32 h-96 w-96 rounded-full bg-fuchsia-300/15 blur-3xl blob-float-2" />
        <div aria-hidden className="pointer-events-none absolute bottom-20 left-1/3 h-72 w-72 rounded-full bg-cyan-200/10 blur-3xl blob-float-3" />

        {loading ? <SkeletonPage /> : error ? <ErrorState onRetry={fetchData} /> : (
          <motion.div variants={stagger} initial="hidden" animate="show"
            className="container relative mx-auto max-w-4xl px-4">

            {/* ── HERO PROFILE CARD ── */}
            <motion.div variants={fadeUp}
              className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 shadow-2xl shadow-violet-400/30">
              {/* decorative */}
              <div className="absolute inset-0 pointer-events-none">
                <div aria-hidden className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-white/10 blur-2xl blob-glow-1" />
                <div aria-hidden className="absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-300/20 blur-2xl blob-glow-2" />
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                {/* grid pattern overlay */}
                <div className="absolute inset-0 opacity-[0.04]"
                  style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
              </div>

              <div className="relative z-10 p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                  {/* avatar */}
                  <div className="relative group shrink-0">
                    <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="relative h-28 w-28 sm:h-36 sm:w-36 rounded-2xl bg-white/20 border-2 border-white/40 backdrop-blur-sm shadow-2xl overflow-hidden ring-4 ring-white/10">
                      {imageUrl ? (
                        <img src={imageUrl} alt={info?.name || "Contact"} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-white/10">
                          <User className="h-14 w-14 text-white/60" />
                        </div>
                      )}
                      <AnimatePresence>
                        {isAdmin && editing && (
                          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                            className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm text-white cursor-pointer">
                            {uploadingImage ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                              <><Camera className="h-6 w-6 mb-1" /><span className="text-[10px] font-semibold">Change Photo</span></>
                            )}
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    {/* online dot */}
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring", stiffness: 400 }}
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-lg">
                      <span className="relative flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                      </span>
                    </motion.div>
                  </div>

                  {/* name + bio */}
                  <div className="flex-1 text-center sm:text-left">
                    <AnimatePresence mode="wait">
                      {editing ? (
                        <motion.input key="name-edit" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className="w-full max-w-sm rounded-xl bg-white/15 border border-white/25 px-4 py-2.5 text-2xl sm:text-3xl font-extrabold text-white placeholder:text-white/40 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                          value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Your name" />
                      ) : (
                        <motion.h1 key="name-view" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className="text-3xl sm:text-4xl font-extrabold text-white drop-shadow-sm tracking-tight">{info?.name}
                        </motion.h1>
                      )}
                    </AnimatePresence>

                    <AnimatePresence mode="wait">
                      {editing ? (
                        <motion.textarea key="bio-edit" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className="w-full mt-3 rounded-xl bg-white/15 border border-white/25 px-4 py-2.5 text-sm text-violet-100 placeholder:text-white/40 backdrop-blur-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/30 transition"
                          rows={2} value={draft.bio ?? ""} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="Write a short bio..." />
                      ) : (
                        <motion.p key="bio-view" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                          className="mt-2.5 text-sm sm:text-base text-violet-200 max-w-lg leading-relaxed">{info?.bio}
                        </motion.p>
                      )}
                    </AnimatePresence>

                    {!editing && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                        className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                        {[
                          { icon: Sparkles, text: "USAT Prep" },
                          { icon: Globe,    text: "Online" },
                          { icon: Heart,    text: "Student-First" },
                        ].map((tag) => (
                          <span key={tag.text}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-xs font-semibold text-violet-100 backdrop-blur-sm hover:bg-white/25 transition-colors cursor-default">
                            <tag.icon className="h-3 w-3" /> {tag.text}
                          </span>
                        ))}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* decorative dot row at the bottom of hero */}
              <div className="relative z-10 px-8 pb-5 flex gap-1.5">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-1 rounded-full bg-white/25" style={{ width: i === 0 ? 24 : 8 }} />
                ))}
              </div>
            </motion.div>

            {/* admin edit bar */}
            <AnimatePresence>
              {isAdmin && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-between mb-6">
                  {updatedAt && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Last updated {updatedAt}
                    </span>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <AnimatePresence mode="wait">
                      {editing ? (
                        <motion.div key="edit-actions" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} className="flex gap-2">
                          <button onClick={() => { setEditing(false); setDraft(info ?? {}); }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition">
                            <X className="h-4 w-4" /> Cancel
                          </button>
                          <button onClick={handleSave} disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-300/30 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-60">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                          </button>
                        </motion.div>
                      ) : (
                        <motion.button key="edit-btn" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                          onClick={() => setEditing(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-300/30 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                          <Pencil className="h-4 w-4" /> Edit Page
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── EMAIL + AVAILABILITY CARDS ── */}
            <div className="grid md:grid-cols-2 gap-5 mb-6">
              {/* EMAIL */}
              <motion.div variants={fadeUp}
                className="group card-hover relative overflow-hidden bg-white rounded-2xl p-6 shadow-md border border-violet-100 hover:shadow-xl hover:shadow-violet-100/40 hover:border-violet-200 transition-all">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-violet-400 to-fuchsia-400 rounded-t-2xl" />
                <div className="flex items-center gap-3 mb-4 mt-1">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-200 group-hover:shadow-lg group-hover:scale-105 transition-all">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Email</h3>
                    <p className="text-xs text-slate-400">Get in touch directly</p>
                  </div>
                </div>
                <AnimatePresence mode="wait">
                  {editing ? (
                    <motion.input key="email-edit" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                      className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                      value={(draft.email as string) ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value || null })} placeholder="email@example.com" />
                  ) : info?.email ? (
                    <motion.div key="email-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2">
                      <a href={`mailto:${info.email}`} className="text-sm font-semibold text-violet-600 hover:text-violet-700 transition truncate flex-1">{info.email}</a>
                      <button onClick={copyEmail}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100 hover:scale-110 transition-all border border-violet-200"
                        title="Copy email">
                        {copiedEmail ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <a href={`mailto:${info.email}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100 hover:scale-110 transition-all border border-violet-200"
                        title="Send email">
                        <Send className="h-3.5 w-3.5" />
                      </a>
                    </motion.div>
                  ) : (
                    <motion.p key="email-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 italic">Not configured yet</motion.p>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* AVAILABILITY */}
              <motion.div variants={fadeUp}
                className="group card-hover relative overflow-hidden bg-white rounded-2xl p-6 shadow-md border border-emerald-100 hover:shadow-xl hover:shadow-emerald-100/40 hover:border-emerald-200 transition-all">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-t-2xl" />
                <div className="flex items-center gap-3 mb-4 mt-1">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-md shadow-emerald-200 group-hover:shadow-lg group-hover:scale-105 transition-all">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Availability</h3>
                    <p className="text-xs text-slate-400">Current status</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
                    <div className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-700">Available for queries</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>Typically responds within 24 hours</span>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── SOCIAL LINKS ── */}
            <motion.div variants={fadeUp}
              className="bg-white rounded-2xl shadow-md border border-violet-100 mb-6 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4">
                <h2 className="font-bold text-white text-sm flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Connect With Me
                </h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {socialLinks.map((link, idx) => {
                  const value = info?.[link.key] ?? "";
                  return (
                    <motion.div key={link.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + idx * 0.06, type: "spring", stiffness: 120, damping: 16 }}>
                      <AnimatePresence mode="wait">
                        {editing ? (
                          <motion.div key={`${link.key}-edit`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                            className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/50">
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${link.iconBg}`}>
                              <link.icon className={`h-4 w-4 ${link.iconColor}`} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1 block">{link.label}</label>
                              <input
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                                value={(draft[link.key] as string) ?? ""}
                                onChange={(e) => setDraft({ ...draft, [link.key]: e.target.value || null })}
                                placeholder="https://..." />
                            </div>
                          </motion.div>
                        ) : value ? (
                          <motion.a key={`${link.key}-view`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                            href={value} target="_blank" rel="noopener noreferrer"
                            className={`card-hover group/link relative overflow-hidden flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 bg-white transition-all shadow-sm hover:shadow-md ${link.hoverColor}`}>
                            <div className={`absolute top-0 left-0 h-0.5 w-0 bg-gradient-to-r ${link.accentBar} group-hover/link:w-full transition-all duration-300`} />
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${link.iconBg} transition-transform group-hover/link:scale-110`}>
                              <link.icon className={`h-4 w-4 ${link.iconColor}`} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-700 group-hover/link:text-slate-900 transition-colors">{link.label}</div>
                              <div className="text-xs text-slate-400 truncate">{value.replace(/^https?:\/\/(www\.)?/, "")}</div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-slate-300 opacity-0 group-hover/link:opacity-100 transition-all group-hover/link:translate-x-0.5 shrink-0" />
                          </motion.a>
                        ) : (
                          <motion.div key={`${link.key}-empty`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                              <link.icon className="h-4 w-4 text-slate-300" />
                            </span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-400">{link.label}</div>
                              <div className="text-xs text-slate-300">{link.desc}</div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* ── COMMUNITY SECTION ── */}
            <motion.div variants={fadeUp}
              className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-md mb-6">
              <div className="relative bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600 px-6 sm:px-8 py-8">
                {/* shine sweep (CSS-only) */}
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 animate-[shimmer_8s_linear_infinite]"
                  style={{ backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", backgroundSize: "200% 100%" }} />
                <div aria-hidden className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-xl" />
                <div aria-hidden className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-indigo-300/20 blur-xl" />
                {/* dot grid */}
                <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                  style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />

                <div className="relative z-10 flex flex-col items-center gap-5">
                  <div className="flex flex-col sm:flex-row items-center gap-5 w-full">
                    <motion.div whileHover={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 0.5 }}
                      className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm shadow-lg">
                      <Users className="h-8 w-8 text-white" />
                    </motion.div>
                    <div className="text-center sm:text-left flex-1">
                      <h2 className="text-xl font-extrabold text-white">Join the Student Community</h2>
                      <p className="text-sm text-indigo-100 mt-1.5 max-w-md leading-relaxed">
                        Connect with fellow students, share study tips, and get help from peers preparing for USAT & HAT.
                      </p>
                    </div>
                  </div>

                  {editing && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="w-full grid sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 rounded-xl bg-white/15 border border-white/25 px-4 py-2.5 backdrop-blur-sm">
                        <MessageCircle className="h-4 w-4 text-white/70 shrink-0" />
                        <input className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                          value={(draft.discord_url as string) ?? ""} onChange={(e) => setDraft({ ...draft, discord_url: e.target.value || null })} placeholder="Discord invite link..." />
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-white/15 border border-white/25 px-4 py-2.5 backdrop-blur-sm">
                        <Phone className="h-4 w-4 text-white/70 shrink-0" />
                        <input className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                          value={(draft.whatsapp_url as string) ?? ""} onChange={(e) => setDraft({ ...draft, whatsapp_url: e.target.value || null })} placeholder="WhatsApp group/channel link..." />
                      </div>
                    </motion.div>
                  )}

                  {!editing && (info?.discord_url || info?.whatsapp_url) && (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      {info?.discord_url && (
                        <motion.a href={info.discord_url} target="_blank" rel="noopener noreferrer"
                          whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-lg hover:shadow-xl transition-all">
                          <MessageCircle className="h-4 w-4" /> Join Discord <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
                        </motion.a>
                      )}
                      {info?.whatsapp_url && (
                        <motion.a href={info.whatsapp_url} target="_blank" rel="noopener noreferrer"
                          whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 px-6 py-3 text-sm font-bold text-emerald-700 shadow-lg hover:shadow-xl hover:bg-emerald-100 transition-all">
                          <Phone className="h-4 w-4" /> Join WhatsApp <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
                        </motion.a>
                      )}
                    </div>
                  )}
                  {!editing && !info?.discord_url && !info?.whatsapp_url && (
                    <span className="text-sm text-indigo-200 italic">Community links coming soon</span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── TRUST INDICATORS ── */}
            <motion.div variants={fadeUp} className="grid grid-cols-3 gap-4 mb-8">
              {[
                { icon: Shield, label: "Trusted Platform", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-100", bar: "from-violet-400 to-purple-400" },
                { icon: Users,  label: "Growing Community", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", bar: "from-indigo-400 to-blue-400" },
                { icon: Heart,  label: "Student-Focused",   color: "text-fuchsia-600", bg: "bg-fuchsia-50", border: "border-fuchsia-100", bar: "from-fuchsia-400 to-pink-400" },
              ].map((item) => (
                <motion.div key={item.label} whileHover={{ y: -3, transition: { type: "spring", stiffness: 320, damping: 22 } }}
                  className={`relative overflow-hidden flex flex-col items-center gap-2 rounded-2xl ${item.bg} border ${item.border} py-5 px-3 text-center transition-shadow hover:shadow-md`}>
                  <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${item.bar}`} />
                  <item.icon className={`h-5 w-5 ${item.color} mt-1`} />
                  <span className="text-xs font-semibold text-slate-600">{item.label}</span>
                </motion.div>
              ))}
            </motion.div>

            {/* ── FOOTER ── */}
            <motion.div variants={fadeUp} className="text-center pt-2 pb-4">
              <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                Made with <Heart className="h-3 w-3 text-rose-400 fill-rose-400" /> by the PrepNest Team
              </p>
            </motion.div>

          </motion.div>
        )}
      </div>
    </>
  );
};

export default Contact;
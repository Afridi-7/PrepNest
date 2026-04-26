import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion } from "framer-motion";
import { BookOpen, Search, ChevronRight, Menu, X, ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";

/* ── Load all user-facing markdown files at build time ─────────────────
   Each file under `src/docs/user/*.md` becomes one section. The numeric
   prefix in the filename (e.g. `01-overview.md`) controls ordering. */
const docFiles = import.meta.glob("../docs/user/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

type Section = {
  slug: string;
  title: string;
  content: string;
  order: number;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const buildSections = (): Section[] => {
  const sections: Section[] = Object.entries(docFiles).map(([path, raw]) => {
    const file = path.split("/").pop() || "";
    const match = file.match(/^(\d+)[-_]?(.*)\.md$/i);
    const order = match ? Number.parseInt(match[1], 10) : 999;
    const stem = match ? match[2] : file.replace(/\.md$/i, "");
    // Title comes from the first H1 in the file, fallback to filename.
    const h1 = raw.match(/^#\s+(.+?)\s*$/m);
    const title = h1 ? h1[1].trim() : stem.replace(/[-_]/g, " ");
    const slug = slugify(stem);
    // Strip the leading H1 from the rendered content so we don't show it twice.
    const content = h1 ? raw.replace(h1[0], "").replace(/^\s+/, "") : raw;
    return { slug, title, content, order };
  });
  return sections.sort((a, b) => a.order - b.order);
};

const SECTIONS: Section[] = buildSections();

const Docs = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // The active section is taken from the URL hash, defaulting to the first.
  const activeSlug = (location.hash || `#${SECTIONS[0]?.slug ?? ""}`).replace(/^#/, "");
  const active = SECTIONS.find((s) => s.slug === activeSlug) ?? SECTIONS[0];

  // Filter sidebar by search query (matches title or any content line).
  const filtered = useMemo(() => {
    if (!query.trim()) return SECTIONS;
    const q = query.toLowerCase();
    return SECTIONS.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q),
    );
  }, [query]);

  // Scroll the main column to the top when switching sections.
  useEffect(() => {
    const el = document.getElementById("docs-main");
    if (el) el.scrollTo({ top: 0, behavior: "smooth" });
    setMobileNavOpen(false);
  }, [activeSlug]);

  const goTo = (slug: string) => {
    navigate({ pathname: "/help", hash: `#${slug}` });
  };

  return (
    <>
      <Navbar />

      <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/40 pt-20 pb-12 dark:from-background dark:via-background dark:to-background">
        <div className="container mx-auto max-w-7xl px-4">
          {/* ── Hero header ── */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative mb-8 overflow-hidden rounded-3xl border border-blue-200/50 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-7 shadow-xl shadow-blue-400/20 dark:border-primary/20"
          >
            <Link
              to="/"
              className="relative z-10 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/30"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
            <div className="relative z-10 mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur-sm">
              <BookOpen className="h-3.5 w-3.5" /> Help Center
            </div>
            <h1 className="relative z-10 mt-3 text-3xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              PrepNest Help Center
            </h1>
            <p className="relative z-10 mt-1.5 max-w-2xl text-sm text-blue-100">
              Everything you need to get started, master each feature, and troubleshoot
              issues — written in plain language and updated as the product evolves.
            </p>

            {/* Search */}
            <div className="relative z-10 mt-5 max-w-md">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-200" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search docs…"
                  className="w-full rounded-xl border border-white/25 bg-white/15 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-blue-100/70 backdrop-blur-md focus:border-white/50 focus:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>

            {/* decorative orbs */}
            <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
          </motion.section>

          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground dark:hover:bg-muted lg:hidden"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            {mobileNavOpen ? "Close menu" : "Browse sections"}
          </button>

          {/* ── Two-column layout: sidebar + content ── */}
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* Sidebar */}
            <aside
              className={`${
                mobileNavOpen ? "block" : "hidden"
              } lg:block lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto`}
            >
              <nav
                aria-label="Documentation sections"
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card"
              >
                <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-muted-foreground">
                  Contents
                </p>
                <ul className="flex flex-col gap-0.5">
                  {filtered.length === 0 && (
                    <li className="px-3 py-2 text-xs text-slate-500 dark:text-muted-foreground">
                      No matches
                    </li>
                  )}
                  {filtered.map((s) => {
                    const isActive = s.slug === active.slug;
                    return (
                      <li key={s.slug}>
                        <button
                          type="button"
                          onClick={() => goTo(s.slug)}
                          className={`group flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                            isActive
                              ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm shadow-blue-500/30"
                              : "text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:text-foreground dark:hover:bg-primary/10 dark:hover:text-primary"
                          }`}
                        >
                          <span className="truncate">{s.title}</span>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 transition-transform ${
                              isActive ? "translate-x-0.5 text-white" : "text-slate-400 group-hover:translate-x-0.5 dark:text-muted-foreground"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </aside>

            {/* Content */}
            <main
              id="docs-main"
              className="min-w-0 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10 dark:border-border dark:bg-card"
            >
              <article className="docs-prose prose prose-slate max-w-none dark:prose-invert">
                <h1>{active.title}</h1>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {active.content}
                </ReactMarkdown>
              </article>

              {/* Prev / Next nav */}
              <div className="mt-12 flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-border sm:flex-row sm:items-center sm:justify-between">
                {(() => {
                  const idx = SECTIONS.findIndex((s) => s.slug === active.slug);
                  const prev = idx > 0 ? SECTIONS[idx - 1] : null;
                  const next = idx < SECTIONS.length - 1 ? SECTIONS[idx + 1] : null;
                  return (
                    <>
                      {prev ? (
                        <button
                          type="button"
                          onClick={() => goTo(prev.slug)}
                          className="group flex flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-border dark:bg-card dark:hover:border-primary/40 dark:hover:bg-primary/5"
                        >
                          <ChevronRight className="h-4 w-4 rotate-180 text-slate-400 transition group-hover:-translate-x-0.5 group-hover:text-blue-600 dark:text-muted-foreground dark:group-hover:text-primary" />
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground">
                              Previous
                            </div>
                            <div className="truncate text-sm font-semibold text-slate-800 dark:text-foreground">
                              {prev.title}
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="flex-1" />
                      )}
                      {next ? (
                        <button
                          type="button"
                          onClick={() => goTo(next.slug)}
                          className="group flex flex-1 items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-border dark:bg-card dark:hover:border-primary/40 dark:hover:bg-primary/5"
                        >
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-muted-foreground">
                              Next
                            </div>
                            <div className="truncate text-sm font-semibold text-slate-800 dark:text-foreground">
                              {next.title}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-muted-foreground dark:group-hover:text-primary" />
                        </button>
                      ) : (
                        <div className="flex-1" />
                      )}
                    </>
                  );
                })()}
              </div>
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default Docs;

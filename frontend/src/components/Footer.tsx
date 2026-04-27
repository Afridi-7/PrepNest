import { Link } from "react-router-dom";
import { Sparkles, ArrowUpRight } from "lucide-react";
import SocialLinks from "@/components/SocialLinks";

interface Props {
  /** Renders the "Connect with us" social row + heading (used on Landing). */
  withSocial?: boolean;
}

const FooterLink = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link
    to={to}
    className="group inline-flex items-center gap-1 text-sm text-slate-500 transition-all duration-200 hover:translate-x-0.5 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300"
  >
    <span>{children}</span>
    <ArrowUpRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
  </Link>
);

const ColumnHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">
    <span className="h-1 w-1 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
    {children}
  </h4>
);

/** Site-wide professional footer. Holds product, resources, legal, and social links. */
const Footer = ({ withSocial = false }: Props) => {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-slate-200/70 bg-gradient-to-b from-white via-blue-50/40 to-white dark:border-slate-800/70 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
      {/* Decorative orbs */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl dark:bg-blue-600/10" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-600/10" />
      {/* Subtle grid pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent dark:via-blue-500/40" />

      <div className="container relative mx-auto px-4 py-14">
        {withSocial && (
          <div className="relative mb-12 overflow-hidden rounded-3xl border border-blue-200/60 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 p-8 shadow-xl shadow-blue-400/20 dark:border-primary/30 sm:p-10">
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-cyan-300/25 blur-3xl" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />

            <div className="relative z-10 flex flex-col items-center gap-5 text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest text-blue-100 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" /> Stay in the loop
              </div>
              <div>
                <h3 className="font-heading text-2xl font-extrabold tracking-tight text-white drop-shadow-sm sm:text-3xl">
                  Connect with us
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-blue-100 sm:text-base">
                  Follow PrepNest for study tips, product updates, and exam-prep insights — wherever you scroll.
                </p>
              </div>
              <SocialLinks />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="group inline-flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-1.5 shadow-md shadow-blue-400/40 transition-transform group-hover:scale-105 group-hover:rotate-3">
                <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-lg object-contain" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-heading text-base font-extrabold text-foreground">PrepNest</span>
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-blue-500">AI Powered</span>
              </div>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              AI-powered USAT &amp; HAT prep — adaptive practice, mock tests, and a personal tutor that learns with you.
            </p>
          </div>

          {/* Product */}
          <div>
            <ColumnHeading>Product</ColumnHeading>
            <ul className="space-y-2.5">
              <li><FooterLink to="/usat">USAT</FooterLink></li>
              <li><FooterLink to="/practice">Practice</FooterLink></li>
              <li><FooterLink to="/mock-test">Mock Tests</FooterLink></li>
              <li><FooterLink to="/ai-tutor">AI Tutor</FooterLink></li>
              <li><FooterLink to="/dashboard">Dashboard</FooterLink></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <ColumnHeading>Resources</ColumnHeading>
            <ul className="space-y-2.5">
              <li><FooterLink to="/help">Help Center</FooterLink></li>
              <li><FooterLink to="/docs">Documentation</FooterLink></li>
              <li><FooterLink to="/help#faq">FAQs</FooterLink></li>
              <li><FooterLink to="/help#getting-started">Getting Started</FooterLink></li>
              <li><FooterLink to="/help#troubleshooting">Troubleshooting</FooterLink></li>
            </ul>
          </div>

          {/* Company / Legal */}
          <div>
            <ColumnHeading>Company</ColumnHeading>
            <ul className="space-y-2.5">
              <li><FooterLink to="/about">About Us</FooterLink></li>
              <li><FooterLink to="/privacy">Privacy Policy</FooterLink></li>
              <li><FooterLink to="/terms">Terms of Service</FooterLink></li>
            </ul>
          </div>
        </div>

        {/* Divider with center dot */}
        <div className="relative mt-12">
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-white via-blue-50/40 to-white px-3 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950">
            <span className="block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500" />
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {year} <span className="font-semibold text-foreground">PrepNest AI</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

import { Link } from "react-router-dom";
import SocialLinks from "@/components/SocialLinks";

interface Props {
  /** Renders the "Connect with us" social row + heading (used on Landing). */
  withSocial?: boolean;
}

/** Site-wide professional footer. Holds product, resources, legal, and social links. */
const Footer = ({ withSocial = false }: Props) => {
  const year = new Date().getFullYear();

  const linkClass =
    "text-sm text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300";

  return (
    <footer className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        {withSocial && (
          <div className="mb-10 flex flex-col items-center gap-4 border-b border-slate-100 pb-10 text-center dark:border-slate-800">
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground">Connect with us</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow PrepNest for study tips, product updates, and exam-prep insights.
              </p>
            </div>
            <SocialLinks />
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 p-1">
                <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded object-contain" />
              </div>
              <span className="font-heading text-base font-bold text-foreground">PrepNest</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              AI-powered USAT &amp; HAT prep — adaptive practice, mock tests, and a personal tutor that learns with you.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Product
            </h4>
            <ul className="space-y-2">
              <li><Link to="/usat" className={linkClass}>USAT</Link></li>
              <li><Link to="/practice" className={linkClass}>Practice</Link></li>
              <li><Link to="/mock-test" className={linkClass}>Mock Tests</Link></li>
              <li><Link to="/ai-tutor" className={linkClass}>AI Tutor</Link></li>
              <li><Link to="/dashboard" className={linkClass}>Dashboard</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Resources
            </h4>
            <ul className="space-y-2">
              <li><Link to="/help" className={linkClass}>Help Center</Link></li>
              <li><Link to="/docs" className={linkClass}>Documentation</Link></li>
              <li><Link to="/help#faq" className={linkClass}>FAQs</Link></li>
              <li><Link to="/help#getting-started" className={linkClass}>Getting Started</Link></li>
              <li><Link to="/help#troubleshooting" className={linkClass}>Troubleshooting</Link></li>
            </ul>
          </div>

          {/* Company / Legal */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
              Company
            </h4>
            <ul className="space-y-2">
              <li><Link to="/about" className={linkClass}>About Us</Link></li>
              <li><Link to="/privacy" className={linkClass}>Privacy Policy</Link></li>
              <li><Link to="/terms" className={linkClass}>Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-6 text-center dark:border-slate-800 sm:flex-row sm:text-left">
          <p className="text-xs text-muted-foreground">
            &copy; {year} PrepNest AI. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Made with care for ambitious students.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

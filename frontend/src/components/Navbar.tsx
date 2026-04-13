import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "USAT", path: "/usat" },
  { label: "Practice", path: "/practice" },
  { label: "AI Tutor", path: "/ai-tutor" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Contact", path: "/contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = apiClient.isAuthenticated();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    apiClient.clearToken();
    setMobileOpen(false);
    navigate("/");
  };

  return (
    <motion.nav
      initial={false}
      animate={{ backgroundColor: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.75)" }}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-shadow duration-300 ${
        scrolled ? "border-violet-100 shadow-lg shadow-violet-100/30" : "border-transparent shadow-none"
      }`}
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-1.5 shadow-lg shadow-violet-300/50"
          >
            <img src="/logo.png" alt="PrepNest AI" className="h-full w-full rounded-lg object-contain" />
          </motion.div>
          <div className="flex flex-col">
            <span className="font-heading font-bold text-lg leading-tight text-foreground">PrepNest</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-violet-500 leading-none">AI Powered</span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-0.5 bg-slate-50/60 rounded-2xl px-1.5 py-1 border border-slate-100">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md shadow-violet-300/40"
                    : "text-slate-500 hover:text-violet-600 hover:bg-violet-50"
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          {isAuthenticated ? (
            <Button variant="outline" size="sm" className="font-semibold rounded-xl border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="font-semibold rounded-xl hover:bg-violet-50 hover:text-violet-700">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" variant="gradient" className="rounded-xl shadow-md shadow-violet-300/40 gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2 rounded-xl hover:bg-violet-50 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5 text-slate-600" /> : <Menu className="h-5 w-5 text-slate-600" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white/95 border-t border-violet-100"
            style={{ backdropFilter: "blur(20px)" }}
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNav(link.path)}
                    className={`block w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? "text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-md shadow-violet-200"
                        : "text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
              {isAuthenticated ? (
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full rounded-xl" onClick={handleLogout}>Logout</Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-xl">Log In</Button>
                  </Link>
                  <Link to="/signup" className="flex-1">
                    <Button size="sm" variant="gradient" className="w-full rounded-xl">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;

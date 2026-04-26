import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Sparkles, Moon, Sun, Shield } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";

const navLinks = [
  { label: "Home", path: "/", auth: "any" as const },
  { label: "USAT", path: "/usat", auth: "required" as const },
  { label: "Practice", path: "/practice", auth: "required" as const },
  { label: "AI Tutor", path: "/ai-tutor", auth: "required" as const },
  { label: "Dashboard", path: "/dashboard", auth: "required" as const },
  { label: "Help", path: "/help", auth: "any" as const },
  { label: "Contact", path: "/contact", auth: "any" as const },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const isAuthenticated = apiClient.isAuthenticated();
  const isDark = mounted && resolvedTheme === "dark";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      apiClient.checkIsAdmin().then(setIsAdmin).catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [isAuthenticated]);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = () => {
    apiClient.clearToken();
    setMobileOpen(false);
    navigate("/");
  };

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <motion.nav
      initial={false}
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-slate-200/60 bg-white/80 shadow-lg shadow-slate-200/30 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/80 dark:shadow-black/30 dark:backdrop-blur-xl"
          : "border-slate-100/40 bg-white/60 shadow-sm backdrop-blur-lg dark:border-slate-900/40 dark:bg-slate-950/60 dark:shadow-black/20 dark:backdrop-blur-lg"
      }`}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="group flex items-center gap-2.5">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-1.5 shadow-lg shadow-blue-400/40 transition-shadow hover:shadow-blue-400/60"
          >
            <img src="/logo.png" alt="PrepNest AI" className="h-full w-full rounded-lg object-contain" />
          </motion.div>
          <div className="flex flex-col">
            <span className="font-heading text-lg font-bold leading-tight text-foreground">PrepNest</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] leading-none text-blue-500">AI Powered</span>
          </div>
        </Link>

        <div className="hidden items-center gap-0.5 rounded-2xl border border-slate-200/60 bg-slate-50/80 px-1.5 py-1 backdrop-blur-sm dark:border-slate-800/60 dark:bg-slate-900/80 md:flex">
          {navLinks.filter(l => l.auth === "any" || isAuthenticated).map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <button
                key={link.path}
                onClick={() => handleNav(link.path)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-300/40 dark:shadow-blue-950/60"
                    : "text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-100"
                }`}
              >
                {link.label}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => handleNav("/admin")}
              className={`flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-300/40 dark:shadow-amber-950/60"
                  : "text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-slate-800 dark:hover:text-amber-300"
              }`}
            >
              <Shield className="h-3.5 w-3.5" /> Admin
            </button>
          )}
        </div>

        <div className="hidden items-center gap-2.5 md:flex">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-xl border-2 border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-slate-800 dark:hover:text-blue-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {isAuthenticated ? (
            <Button variant="outline" size="sm" className="rounded-xl border-2 border-slate-200 bg-white font-semibold hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-blue-500/50 dark:hover:bg-slate-800 dark:hover:text-blue-100" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="rounded-xl font-semibold hover:bg-blue-50 hover:text-blue-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:text-blue-100">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" variant="gradient" className="gap-1.5 rounded-xl shadow-md shadow-blue-300/40">
                  <Sparkles className="h-3.5 w-3.5" /> Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button
            variant="outline"
            size="icon"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-xl border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/50 dark:hover:bg-slate-800 dark:hover:text-blue-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <button className="rounded-xl p-2 transition-colors hover:bg-blue-50 dark:hover:bg-slate-800" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5 text-slate-600 dark:text-slate-200" /> : <Menu className="h-5 w-5 text-slate-600 dark:text-slate-200" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-blue-100 bg-white dark:border-slate-800 dark:bg-slate-950 md:hidden"
          >
            <div className="space-y-1 px-4 py-3">
              {navLinks.filter(l => l.auth === "any" || isAuthenticated).map((link) => {
                const isActive = location.pathname === link.path;
                return (
                  <button
                    key={link.path}
                    onClick={() => handleNav(link.path)}
                    className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-200 dark:shadow-blue-950/50"
                        : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-100"
                    }`}
                  >
                    {link.label}
                  </button>
                );
              })}
              {isAdmin && (
                <button
                  onClick={() => handleNav("/admin")}
                  className={`flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-semibold transition-all ${
                    location.pathname === "/admin"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-200 dark:shadow-amber-950/50"
                      : "text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-slate-800 dark:hover:text-amber-300"
                  }`}
                >
                  <Shield className="h-4 w-4" /> Admin Panel
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-800 dark:text-slate-100 dark:hover:border-blue-500/50 dark:hover:bg-slate-800 dark:hover:text-blue-100"
              >
                <span>{isDark ? "Light theme" : "Dark theme"}</span>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {isAuthenticated ? (
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full rounded-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800" onClick={handleLogout}>Logout</Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full rounded-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">Log In</Button>
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

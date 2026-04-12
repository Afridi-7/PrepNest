import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
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
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = apiClient.isAuthenticated();

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
    <nav className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-border/40 shadow-lg">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-1.5 shadow-md shadow-violet-300/40 group-hover:scale-110 transition-transform duration-300">
            <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-lg object-contain" />
          </div>
          <span className="font-heading font-bold text-xl text-foreground">PrepNest</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => handleNav(link.path)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                location.pathname === link.path
                  ? "text-primary bg-gradient-to-r from-primary/15 to-secondary/15 shadow-md"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <Button variant="outline" size="sm" className="font-semibold" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="font-semibold">Log In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm" variant="gradient">Sign Up</Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-t border-border"
          >
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.path}
                  onClick={() => handleNav(link.path)}
                  className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                    location.pathname === link.path ? "text-primary bg-primary/10" : "text-muted-foreground"
                  }`}
                >
                  {link.label}
                </button>
              ))}
              {isAuthenticated ? (
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>Logout</Button>
                </div>
              ) : (
                <div className="flex gap-2 pt-2">
                  <Link to="/login" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">Log In</Button>
                  </Link>
                  <Link to="/signup" className="flex-1">
                    <Button size="sm" variant="gradient" className="w-full">Sign Up</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

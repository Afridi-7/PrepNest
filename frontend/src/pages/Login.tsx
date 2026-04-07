import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, Eye, EyeOff, Loader2, Sparkles, ShieldCheck, Zap, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

const Login = () => {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const loginState = location.state as { from?: string; reason?: string } | null;
  const redirectTo = loginState?.from || "/dashboard";

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.login(email, password);
      apiClient.setToken(response.access_token);
      toast({ title: "Success", description: "Logged in successfully!" });
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      if ((error.message || "").toLowerCase().includes("not verified")) {
        toast({
          title: "Verify your email",
          description: error.message,
          variant: "destructive",
        });
        navigate(`/verify-email?email=${encodeURIComponent(email)}&sent=1`);
        return;
      }

      toast({ 
        title: "Login Failed", 
        description: error.message || "Invalid credentials", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/40">
      <div className="absolute -top-28 -left-20 w-72 h-72 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 pattern-dots opacity-20" />
        <div className="absolute inset-0 pattern-grid opacity-10" />
        <div className="absolute top-10 left-10 px-3 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-semibold backdrop-blur">
          Smart Exam Prep
        </div>
        <div className="absolute bottom-10 right-10 px-3 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-semibold backdrop-blur">
          AI Guided Learning
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative text-center z-10 max-w-md"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/40 text-white text-sm font-semibold mb-6 backdrop-blur">
            <Sparkles className="h-4 w-4" /> Trusted by ambitious students
          </div>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <GraduationCap className="h-20 w-20 text-white mx-auto mb-6 drop-shadow-2xl" />
          </motion.div>
          <h2 className="font-heading text-4xl font-bold text-white mb-4 drop-shadow-lg">Welcome Back</h2>
          <p className="text-white/90 max-w-sm mx-auto text-lg">Continue your USAT & HAT preparation journey with AI-powered learning.</p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-xs text-white/95">
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><ShieldCheck className="h-4 w-4 mx-auto mb-1" />Secure</div>
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><Zap className="h-4 w-4 mx-auto mb-1" />Fast</div>
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><Sparkles className="h-4 w-4 mx-auto mb-1" />Smart</div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl p-6 sm:p-7 border border-white/70 shadow-2xl">
          <div className="mb-8">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-5"
            >
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="gradient-primary rounded-lg p-1.5 shadow-md"><GraduationCap className="h-5 w-5 text-primary-foreground" /></div>
              <span className="font-heading font-bold text-lg">PrepNest</span>
            </Link>
            {loginState?.reason === "auth-required" && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                Please log in first to access that section.
              </div>
            )}
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1">Welcome Back</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to continue your progress</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="student@prepnest.app" className="pl-10 h-11 rounded-xl border-border/70 focus-visible:ring-primary/50" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type={showPass ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10 h-11 rounded-xl border-border/70 focus-visible:ring-primary/50" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="w-full h-11 rounded-xl font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

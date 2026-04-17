import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2, Sparkles, ShieldCheck, Zap, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const Login = () => {
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [resending, setResending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const loginState = location.state as { from?: string; reason?: string; flashMessage?: string } | null;
  const redirectTo = loginState?.from || "/dashboard";

  const handleGoogleCallback = useCallback(async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const auth = await apiClient.googleAuth(response.credential);
      apiClient.setToken(auth.access_token, auth.user_name);
      toast({ title: "Success", description: "Logged in with Google!" });
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      if (mountedRef.current) {
        toast({ title: "Google Login Failed", description: error.message || "Could not authenticate with Google", variant: "destructive" });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [navigate, redirectTo, toast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const google = (window as any).google;
    if (!google?.accounts?.id || !googleBtnRef.current) return;

    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    });
    google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.offsetWidth,
      text: "continue_with",
      shape: "pill",
      logo_alignment: "left",
    });
  }, [handleGoogleCallback]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyMsg("");

    if (!email || !password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.login(email, password);
      apiClient.setToken(response.access_token, response.user_name);
      toast({ title: "Success", description: "Logged in successfully!" });
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      const msg = error.message || "Invalid credentials";
      if (msg.toLowerCase().includes("verify your email")) {
        setVerifyMsg(msg);
      } else {
        toast({
          title: "Login Failed",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({ title: "Error", description: "Enter your email first", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      await apiClient.resendVerification(email);
      toast({ title: "Sent", description: "Verification email resent. Check your inbox." });
    } catch {
      toast({ title: "Error", description: "Could not resend verification email.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">

      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 items-center justify-center p-12 gradient-primary">
        <div className="absolute inset-0 pattern-dots opacity-20" />
        <div className="absolute inset-0 pattern-grid opacity-10" />
        <div className="absolute top-10 left-10 rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          Smart Exam Prep
        </div>
        <div className="absolute bottom-10 right-10 rounded-full border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          AI Guided Learning
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-md text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            <Sparkles className="h-4 w-4" /> Trusted by ambitious students
          </div>
          <div className="animate-[gentle-rock_6s_ease-in-out_infinite]">
            <div className="mx-auto mb-6 h-32 w-32 rounded-2xl bg-gradient-to-br from-blue-600/90 to-cyan-600/90 p-3 shadow-2xl shadow-blue-400/50">
              <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-xl object-contain drop-shadow-2xl" />
            </div>
          </div>
          <h2 className="mb-4 font-heading text-4xl font-bold text-white drop-shadow-lg">Welcome Back</h2>
          <p className="mx-auto max-w-sm text-lg text-white/90">Continue your USAT & HAT preparation journey with AI-powered learning.</p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-xs text-white/95">
            <div className="rounded-xl border border-white/30 bg-white/15 p-3 backdrop-blur"><ShieldCheck className="mx-auto mb-1 h-4 w-4" />Secure</div>
            <div className="rounded-xl border border-white/30 bg-white/15 p-3 backdrop-blur"><Zap className="mx-auto mb-1 h-4 w-4" />Fast</div>
            <div className="rounded-xl border border-white/30 bg-white/15 p-3 backdrop-blur"><Sparkles className="mx-auto mb-1 h-4 w-4" />Smart</div>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-blue-200 bg-white/95 p-6 shadow-2xl shadow-blue-200/30 dark:border-blue-500/20 dark:bg-slate-900/92 dark:shadow-black/30 sm:p-7"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />
          <div className="mb-8">
            <button
              type="button"
              onClick={handleBack}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
            <Link to="/" className="mb-8 flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-1.5 shadow-md shadow-blue-300/40">
                <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-lg object-contain" />
              </div>
              <span className="font-heading text-lg font-bold">PrepNest</span>
            </Link>
            {loginState?.flashMessage && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
                {loginState.flashMessage}
              </div>
            )}
            {loginState?.reason === "auth-required" && (
              <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm text-foreground dark:border-primary/20 dark:bg-primary/15">
                Please log in first to access that section.
              </div>
            )}
            {verifyMsg && (
              <div className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{verifyMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  {resending ? "Resending..." : "Resend verification email"}
                </button>
              </div>
            )}
            <h1 className="mb-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">Welcome Back</h1>
            <p className="text-sm text-slate-400">Enter your credentials to continue your progress</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="student@prepnest.app"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-10 transition-colors focus-visible:border-blue-300 focus-visible:ring-blue-400/50 dark:border-slate-700 dark:bg-slate-950/60"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary transition-colors hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPass ? "text" : "password"}
                  placeholder="........"
                  className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-10 transition-colors focus-visible:border-blue-300 focus-visible:ring-blue-400/50 dark:border-slate-700 dark:bg-slate-950/60"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="h-12 w-full rounded-xl font-semibold shadow-lg shadow-blue-300/30 transition-shadow hover:shadow-xl hover:shadow-blue-300/40" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Logging in..." : "Log In"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          <div ref={googleBtnRef} className="flex w-full justify-center [&>div]:!w-full" />

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account? <Link to="/signup" className="font-medium text-primary hover:underline">Sign up</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, Loader2, Sparkles, Rocket, Target, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const Signup = () => {
  const [showPass, setShowPass] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [resending, setResending] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const handleGoogleCallback = useCallback(async (response: any) => {
    if (!response.credential) return;
    setLoading(true);
    try {
      const auth = await apiClient.googleAuth(response.credential);
      apiClient.setToken(auth.access_token);
      toast({ title: "Success", description: "Signed in with Google!" });
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      if (mountedRef.current) {
        toast({ title: "Google Sign-In Failed", description: error.message || "Could not authenticate with Google", variant: "destructive" });
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [navigate, toast]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
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
      text: "signup_with",
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
    
    if (!email || !password || !name) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }

    if (password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await apiClient.signup(email, password, name);
      setSignupDone(true);
    } catch (error: any) {
      toast({ 
        title: "Sign Up Failed", 
        description: error.message || "Could not create account", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
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
    <div className="min-h-screen flex relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/40">
      <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-purple-300/20 blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-sky-300/20 blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-violet-200/15 blur-3xl" />

      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 pattern-dots opacity-20" />
        <div className="absolute inset-0 pattern-grid opacity-10" />
        <div className="absolute top-10 left-10 px-3 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-semibold backdrop-blur">
          Built for USAT/HAT
        </div>
        <div className="absolute bottom-10 right-10 px-3 py-1.5 rounded-full bg-white/20 border border-white/40 text-white text-xs font-semibold backdrop-blur">
          Personalized Path
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative text-center z-10 max-w-md"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 border border-white/40 text-white text-sm font-semibold mb-6 backdrop-blur">
            <Sparkles className="h-4 w-4" /> Start strong, stay consistent
          </div>
          <div className="animate-[gentle-rock_6s_ease-in-out_infinite]">
            <div className="h-32 w-32 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-600/90 to-fuchsia-600/90 p-3 shadow-2xl shadow-violet-400/50">
              <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-xl object-contain drop-shadow-2xl" />
            </div>
          </div>
          <h2 className="font-heading text-4xl font-bold text-white mb-4 drop-shadow-lg">Join PrepNest</h2>
          <p className="text-white/90 max-w-sm mx-auto text-lg">Start your journey to ace the USAT & HAT exams with personalized AI assistance.</p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-xs text-white/95">
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><Rocket className="h-4 w-4 mx-auto mb-1" />Momentum</div>
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><Target className="h-4 w-4 mx-auto mb-1" />Focus</div>
            <div className="rounded-xl bg-white/15 border border-white/30 p-3 backdrop-blur"><Sparkles className="h-4 w-4 mx-auto mb-1" />Growth</div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md bg-white/95 rounded-3xl p-6 sm:p-7 border-2 border-violet-200 shadow-2xl shadow-violet-200/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />
          {signupDone ? (
            <div className="text-center py-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" as const, stiffness: 200, damping: 15 }}>
                <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Check Your Email</h2>
              <p className="text-muted-foreground text-sm mb-6">
                We've sent a verification link to <strong>{email}</strong>. Please click the link to verify your account before logging in.
              </p>
              <div className="space-y-3">
                <Button variant="outline" className="w-full h-11 rounded-xl font-semibold" disabled={resending} onClick={handleResend}>
                  {resending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resending...</> : "Resend Verification Email"}
                </Button>
                <Link to="/login">
                  <Button variant="gradient" className="w-full h-11 rounded-xl font-semibold">Go to Login</Button>
                </Link>
              </div>
            </div>
          ) : (
          <>
          <div className="mb-8">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-5"
            >
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-1.5 shadow-md shadow-violet-300/40">
                <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-lg object-contain" />
              </div>
              <span className="font-heading font-bold text-lg">PrepNest</span>
            </Link>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-1">Create Account</h1>
            <p className="text-slate-400 text-sm">Join PrepNest and begin your exam prep journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-wide text-muted-foreground">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="name" 
                  placeholder="Enter your full name" 
                  className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-violet-400/50 focus-visible:border-violet-300 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="student@prepnest.app" 
                  className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-violet-400/50 focus-visible:border-violet-300 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type={showPass ? "text" : "password"} 
                  placeholder="••••••••" 
                  className="pl-10 pr-10 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-violet-400/50 focus-visible:border-violet-300 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button 
                  type="button" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
                  onClick={() => setShowPass(!showPass)}
                  disabled={loading}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="gradient" className="w-full h-12 rounded-xl font-semibold shadow-lg shadow-violet-300/30 hover:shadow-xl hover:shadow-violet-300/40 transition-shadow" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-xs text-muted-foreground uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Google sign-in button rendered by Google Identity Services */}
          <div ref={googleBtnRef} className="w-full flex justify-center [&>div]:!w-full" />

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </p>
          </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;

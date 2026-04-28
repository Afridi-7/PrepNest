import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast({ title: "Email required", description: "Enter the email address linked to your account.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await apiClient.forgotPassword(email);
      setSubmitted(true);
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error.message || "We could not process your request right now. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">

      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 items-center justify-center p-12 gradient-primary">
        <div className="absolute inset-0 pattern-dots opacity-20" />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-md text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            <ShieldCheck className="h-4 w-4" /> Secure account recovery
          </div>
          <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-3xl bg-white/15 shadow-2xl shadow-blue-400/40 backdrop-blur">
            <Mail className="h-14 w-14 text-white" />
          </div>
          <h2 className="mb-4 font-heading text-4xl font-bold text-white">Reset Access</h2>
          <p className="text-lg text-white/90">
            We&apos;ll send a secure link so you can choose a new password and get back into PrepNest safely.
          </p>
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-200/40 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/92 dark:shadow-black/30 sm:p-7"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500" />

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
                <img src="/logo.png" alt="PrepNest" decoding="async" className="h-full w-full rounded-lg object-contain" />
              </div>
              <span className="font-heading text-lg font-bold">PrepNest</span>
            </Link>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
              <Sparkles className="h-3.5 w-3.5" /> Password recovery
            </div>
            <h1 className="mb-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">Forgot Password?</h1>
            <p className="text-sm text-slate-400">Enter your email and we&apos;ll send you a secure reset link.</p>
          </div>

          {submitted ? (
            <div className="space-y-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <div>
                <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Check your inbox</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  If that email is registered, a password reset link has been sent. The link will expire soon for your security.
                </p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-800" onClick={() => setSubmitted(false)}>
                  Send again
                </Button>
                <Link to="/login" className="flex-1">
                  <Button variant="gradient" className="w-full">Back to Login</Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@prepnest.app"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-10 dark:border-slate-700 dark:bg-slate-950/60"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <Button type="submit" variant="gradient" className="h-12 w-full rounded-xl font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending reset link...</> : "Send Reset Link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Remembered your password? <Link to="/login" className="font-medium text-primary hover:underline">Log in</Link>
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;

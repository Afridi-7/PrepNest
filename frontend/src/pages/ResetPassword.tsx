import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/services/api";
import { getPasswordRequirementStates, getPasswordStrength, getPasswordValidationErrors } from "@/lib/password";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const passwordIssues = useMemo(() => getPasswordValidationErrors(password), [password]);
  const requirementStates = useMemo(() => getPasswordRequirementStates(password), [password]);
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  useEffect(() => {
    let active = true;

    const validateToken = async () => {
      if (!token) {
        if (active) setStatus("invalid");
        return;
      }
      try {
        await apiClient.validateResetPasswordToken(token);
        if (active) setStatus("ready");
      } catch {
        if (active) setStatus("invalid");
      }
    };

    validateToken();
    return () => {
      active = false;
    };
  }, [token]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/login");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordIssues.length > 0) {
      toast({ title: "Weak password", description: "Choose a stronger password before continuing.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Make sure both password fields match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      setStatus("done");
      setTimeout(() => {
        navigate("/login", {
          replace: true,
          state: {
            flashMessage: "Password updated successfully.",
            reason: "password-reset-success",
          },
        });
      }, 1200);
    } catch (error: any) {
      const message = error.message || "We could not reset your password.";
      if (message.toLowerCase().includes("invalid or expired")) {
        setStatus("invalid");
      }
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-violet-300/20 blur-3xl dark:bg-violet-500/15" />
      <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/15" />

      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 items-center justify-center p-12 gradient-primary">
        <div className="absolute inset-0 pattern-grid opacity-10" />
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-md text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
            <ShieldCheck className="h-4 w-4" /> Single-use secure reset
          </div>
          <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-3xl bg-white/15 shadow-2xl shadow-violet-400/40 backdrop-blur">
            <Lock className="h-14 w-14 text-white" />
          </div>
          <h2 className="mb-4 font-heading text-4xl font-bold text-white">Choose a New Password</h2>
          <p className="text-lg text-white/90">
            Use a strong password you have not used elsewhere. This reset link can only be used once.
          </p>
        </motion.div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-violet-200 bg-white/95 p-6 shadow-2xl shadow-violet-200/30 dark:border-violet-500/20 dark:bg-slate-900/92 dark:shadow-black/30 sm:p-7"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

          <div className="mb-8">
            <button
              type="button"
              onClick={handleBack}
              className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Go back
            </button>
            <Link to="/" className="mb-8 flex items-center gap-2">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 p-1.5 shadow-md shadow-violet-300/40">
                <img src="/logo.png" alt="PrepNest" className="h-full w-full rounded-lg object-contain" />
              </div>
              <span className="font-heading text-lg font-bold">PrepNest</span>
            </Link>
            <h1 className="mb-1 font-heading text-2xl font-bold text-foreground sm:text-3xl">Reset Password</h1>
            <p className="text-sm text-slate-400">Create a new password for your account.</p>
          </div>

          {status === "checking" && (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <Loader2 className="mb-4 h-10 w-10 animate-spin text-violet-500" />
              <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Validating your link</h2>
              <p className="text-sm text-muted-foreground">Please wait while we confirm that your reset token is still valid.</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-5 rounded-2xl border border-rose-200 bg-rose-50/80 p-5 dark:border-rose-500/20 dark:bg-rose-500/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <h2 className="mb-1 font-heading text-xl font-bold text-foreground">Reset link unavailable</h2>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    This reset link is invalid or has expired. Request a new password reset email to continue.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Link to="/forgot-password" className="flex-1">
                  <Button variant="gradient" className="w-full">Request New Link</Button>
                </Link>
                <Link to="/login" className="flex-1">
                  <Button variant="outline" className="w-full dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-800">Back to Login</Button>
                </Link>
              </div>
            </div>
          )}

          {status === "done" && (
            <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
              <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500" />
              <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Password updated</h2>
              <p className="text-sm text-muted-foreground">Redirecting you to the login page...</p>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">New Password</Label>
                  <span className="text-xs font-semibold text-muted-foreground">{strength.label}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strength.tone}`}
                    style={{ width: `${(strength.score / 3) * 100}%` }}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-10 dark:border-slate-700 dark:bg-slate-950/60"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/55">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password requirements</p>
                <div className="space-y-2">
                  {requirementStates.map((requirement) => (
                    <div key={requirement.id} className="flex items-center gap-2 text-sm">
                      <span className={`h-2.5 w-2.5 rounded-full ${requirement.met ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"}`} />
                      <span className={requirement.met ? "text-foreground" : "text-muted-foreground"}>{requirement.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-xs uppercase tracking-wide text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your new password"
                    className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-10 dark:border-slate-700 dark:bg-slate-950/60"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-rose-500">Passwords do not match yet.</p>
                )}
              </div>

              <Button type="submit" variant="gradient" className="h-12 w-full rounded-xl font-semibold" disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating password...</> : "Update Password"}
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;

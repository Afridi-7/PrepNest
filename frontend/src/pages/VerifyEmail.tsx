import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState("");
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    apiClient
      .verifyEmail(token)
      .then((res) => {
        if (res.message?.toLowerCase().includes("already")) {
          setStatus("already");
        } else {
          setStatus("success");
        }
        setMessage(res.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message || "Verification failed. The link may be invalid or expired.");
      });
  }, [token]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-950">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-blue-100/50 bg-white/90 p-8 text-center shadow-2xl shadow-blue-200/20 dark:border-blue-500/20 dark:bg-slate-900/92 dark:shadow-black/30"
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />
        <Link to="/" className="mb-6 inline-flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 p-1.5 shadow-md shadow-blue-300/40">
            <img src="/logo.png" alt="PrepNest" decoding="async" className="h-full w-full rounded-lg object-contain" />
          </div>
          <span className="font-heading text-lg font-bold">PrepNest</span>
        </Link>

        {status === "loading" && (
          <div className="py-8">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Verifying your email...</h2>
            <p className="text-sm text-muted-foreground">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-emerald-500" />
            </motion.div>
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Email Verified!</h2>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            <Link to="/login">
              <Button variant="gradient" className="h-11 w-full rounded-xl font-semibold">
                Log In to Your Account
              </Button>
            </Link>
          </div>
        )}

        {status === "already" && (
          <div className="py-8">
            <Mail className="mx-auto mb-4 h-16 w-16 text-primary" />
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Already Verified</h2>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            <Link to="/login">
              <Button variant="gradient" className="h-11 w-full rounded-xl font-semibold">
                Go to Login
              </Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <XCircle className="mx-auto mb-4 h-16 w-16 text-rose-500" />
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">Verification Failed</h2>
            <p className="mb-6 text-sm text-muted-foreground">{message}</p>
            <div className="space-y-3">
              <Link to="/signup">
                <Button variant="gradient" className="h-11 w-full rounded-xl font-semibold">
                  Sign Up Again
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="h-11 w-full rounded-xl font-semibold dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:bg-slate-800">
                  Back to Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;

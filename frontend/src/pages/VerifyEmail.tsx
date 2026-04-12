import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { GraduationCap, CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/40 to-cyan-50/40">
      <div className="absolute -top-28 -left-20 w-72 h-72 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div className="absolute -bottom-28 -right-24 w-80 h-80 rounded-full bg-cyan-300/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-white/85 backdrop-blur-xl rounded-3xl p-8 border border-white/70 shadow-2xl text-center"
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="gradient-primary rounded-lg p-1.5 shadow-md">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-lg">PrepNest</span>
        </Link>

        {status === "loading" && (
          <div className="py-8">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Verifying your email...</h2>
            <p className="text-muted-foreground text-sm">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring" as const, stiffness: 200, damping: 15 }}
            >
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            </motion.div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Email Verified!</h2>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link to="/login">
              <Button variant="gradient" className="w-full h-11 rounded-xl font-semibold">
                Log In to Your Account
              </Button>
            </Link>
          </div>
        )}

        {status === "already" && (
          <div className="py-8">
            <Mail className="h-16 w-16 text-primary mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Already Verified</h2>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <Link to="/login">
              <Button variant="gradient" className="w-full h-11 rounded-xl font-semibold">
                Go to Login
              </Button>
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="py-8">
            <XCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h2 className="font-heading text-xl font-bold text-foreground mb-2">Verification Failed</h2>
            <p className="text-muted-foreground text-sm mb-6">{message}</p>
            <div className="space-y-3">
              <Link to="/signup">
                <Button variant="gradient" className="w-full h-11 rounded-xl font-semibold">
                  Sign Up Again
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="w-full h-11 rounded-xl font-semibold">
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

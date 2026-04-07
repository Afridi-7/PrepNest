import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailWarning, RefreshCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiClient } from "@/services/api";

type VerifyStatus = "idle" | "loading" | "success" | "error";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const emailFromQuery = searchParams.get("email") || "";
  const sent = searchParams.get("sent") === "1";

  const [status, setStatus] = useState<VerifyStatus>(token ? "loading" : "idle");
  const [message, setMessage] = useState<string>(
    sent
      ? "Verification email sent. Please check your inbox."
      : "Enter your email on login to resend verification if needed."
  );
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const runVerification = async () => {
      if (!token) {
        return;
      }

      setStatus("loading");
      try {
        const response = await apiClient.verifyEmail(token);
        setStatus("success");
        setMessage(response.message);
      } catch (error: any) {
        setStatus("error");
        setMessage(error.message || "Verification failed. The link may be invalid or expired.");
      }
    };

    runVerification();
  }, [token]);

  const handleResend = async () => {
    if (!emailFromQuery) {
      return;
    }

    setIsResending(true);
    try {
      const response = await apiClient.resendVerification(emailFromQuery);
      setMessage(response.message);
      if (status !== "success") {
        setStatus("idle");
      }
    } catch (error: any) {
      setStatus("error");
      setMessage(error.message || "Could not resend verification email.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900">Email Verification</h1>
        <p className="mt-2 text-sm text-slate-600">Complete verification to activate your PrepNest account.</p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 flex items-start gap-3">
          {status === "loading" && <Loader2 className="h-5 w-5 animate-spin text-slate-600 mt-0.5" />}
          {status === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />}
          {status === "error" && <XCircle className="h-5 w-5 text-rose-600 mt-0.5" />}
          {status === "idle" && <MailWarning className="h-5 w-5 text-amber-600 mt-0.5" />}
          <span>{message}</span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {emailFromQuery && status !== "loading" && (
            <Button type="button" variant="outline" onClick={handleResend} disabled={isResending}>
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Resend Email
                </>
              )}
            </Button>
          )}
          <Button asChild>
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

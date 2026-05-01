import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiClient } from "./services/api";
import TrialBanner from "./components/TrialBanner";

const Index = lazy(() => import("./pages/Index.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Signup = lazy(() => import("./pages/Signup.tsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const USAT = lazy(() => import("./pages/USAT.tsx"));
const USATSubjects = lazy(() => import("./pages/USATSubjects.tsx"));
const USATSubjectChapters = lazy(() => import("./pages/USATSubjectChapters.tsx"));
const Practice = lazy(() => import("./pages/Practice.tsx"));
const AITutor = lazy(() => import("./pages/AITutor.tsx"));
const Contact = lazy(() => import("./pages/Contact.tsx"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy.tsx"));
const TermsOfService = lazy(() => import("./pages/TermsOfService.tsx"));
const MockTest = lazy(() => import("./pages/MockTest.tsx"));
const AdminContent = lazy(() => import("./pages/AdminContent.tsx"));
const Docs = lazy(() => import("./pages/Docs.tsx"));
const QueryRoom = lazy(() => import("./pages/QueryRoom.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const BillingSuccess = lazy(() => import("./pages/BillingSuccess.tsx"));
const BillingCancel = lazy(() => import("./pages/BillingCancel.tsx"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy.tsx"));
const OwnershipStatement = lazy(() => import("./pages/OwnershipStatement.tsx"));

// Sensible production defaults: cache responses for 60 s before they become
// stale (per-query `staleTime` still wins), keep them in memory for 5 min, and
// don't hammer the API on every tab refocus. Network/auth retries are kept
// minimal so transient failures surface quickly to the UI.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 0,
    },
  },
});

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  return null;
};

const RequireAuth = ({ children }: { children: ReactElement }) => {
  const location = useLocation();
  if (!apiClient.isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: "auth-required" }} />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ScrollToTop />
          <TrialBanner />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" /></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/usat" element={<RequireAuth><USAT /></RequireAuth>} />
            <Route path="/usat/:category" element={<RequireAuth><USATSubjects /></RequireAuth>} />
            <Route path="/usat/:category/:subject" element={<RequireAuth><USATSubjectChapters /></RequireAuth>} />
            <Route path="/practice" element={<RequireAuth><Practice /></RequireAuth>} />
            <Route path="/mock-test" element={<RequireAuth><MockTest /></RequireAuth>} />
            <Route path="/ai-tutor" element={<RequireAuth><AITutor /></RequireAuth>} />
            <Route path="/query-room" element={<RequireAuth><QueryRoom /></RequireAuth>} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/billing/success" element={<RequireAuth><BillingSuccess /></RequireAuth>} />
            <Route path="/billing/cancel" element={<BillingCancel />} />
            <Route path="/about" element={<Contact />} />
            <Route path="/contact" element={<Navigate to="/about" replace />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/refund" element={<RefundPolicy />} />
            <Route path="/ownership" element={<OwnershipStatement />} />
            <Route path="/admin" element={<RequireAuth><AdminContent /></RequireAuth>} />
            <Route path="/help" element={<Docs />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/faq" element={<Navigate to="/help#faq" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

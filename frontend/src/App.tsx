import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiClient } from "./services/api";

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

const queryClient = new QueryClient();

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
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" /></div>}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/usat" element={<USAT />} />
            <Route path="/usat/:category" element={<USATSubjects />} />
            <Route path="/usat/:category/:subject" element={<USATSubjectChapters />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/mock-test" element={<RequireAuth><MockTest /></RequireAuth>} />
            <Route path="/ai-tutor" element={<AITutor />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/admin" element={<RequireAuth><AdminContent /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

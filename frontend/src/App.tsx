import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import USAT from "./pages/USAT.tsx";
import Practice from "./pages/Practice.tsx";
import AITutor from "./pages/AITutor.tsx";
import AdminContent from "./pages/AdminContent.tsx";
import NotFound from "./pages/NotFound.tsx";
import { apiClient } from "./services/api";

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
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/usat" element={<USAT />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/ai-tutor" element={<AITutor />} />
          <Route path="/admin" element={<RequireAuth><AdminContent /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

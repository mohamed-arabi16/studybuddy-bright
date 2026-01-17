import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";

// Eagerly loaded - needed for initial render
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";

// Lazy loaded pages - split into separate chunks
const Schedule = lazy(() => import("./pages/Schedule"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
const Layout = lazy(() => import("./components/Layout"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Plan = lazy(() => import("./pages/Plan"));
const Settings = lazy(() => import("./pages/Settings"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Refund = lazy(() => import("./pages/Refund"));
const GradeCalculator = lazy(() => import("./pages/GradeCalculator"));

// Admin pages - lazy loaded
const AdminLayout = lazy(() => import("./pages/Admin/Layout"));
const AdminDashboard = lazy(() => import("./pages/Admin/Dashboard"));
const AdminUsers = lazy(() => import("./pages/Admin/Users"));
const AdminPlans = lazy(() => import("./pages/Admin/Plans"));
const AdminPromos = lazy(() => import("./pages/Admin/Promos"));
const AdminQuotas = lazy(() => import("./pages/Admin/Quotas"));
const AdminTrials = lazy(() => import("./pages/Admin/Trials"));
const AdminFeedback = lazy(() => import("./pages/Admin/Feedback"));
const AdminAuditLog = lazy(() => import("./pages/Admin/AuditLog"));
const AdminCredits = lazy(() => import("./pages/Admin/Credits"));
const AdminRefunds = lazy(() => import("./pages/Admin/Refunds"));

const queryClient = new QueryClient();

// Minimal loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/refund" element={<Refund />} />

              <Route path="/app" element={<Layout />}>
                <Route index element={<Navigate to="/app/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="courses" element={<Courses />} />
                <Route path="courses/:id" element={<CourseDetail />} />
                <Route path="plan" element={<Plan />} />
                <Route path="grade-calculator" element={<GradeCalculator />} />
                <Route path="settings" element={<Settings />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                 <Route index element={<AdminDashboard />} />
                 <Route path="users" element={<AdminUsers />} />
                 <Route path="plans" element={<AdminPlans />} />
                 <Route path="promos" element={<AdminPromos />} />
                 <Route path="quotas" element={<AdminQuotas />} />
                 <Route path="trials" element={<AdminTrials />} />
                 <Route path="feedback" element={<AdminFeedback />} />
                 <Route path="audit" element={<AdminAuditLog />} />
                 <Route path="credits" element={<AdminCredits />} />
                 <Route path="refunds" element={<AdminRefunds />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

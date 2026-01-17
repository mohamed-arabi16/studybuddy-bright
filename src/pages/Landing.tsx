import { useEffect, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load below-fold sections for better performance
const HowItWorksSection = lazy(() => 
  import("@/components/landing/HowItWorksSection").then(m => ({ default: m.HowItWorksSection }))
);
const FeatureShowcase = lazy(() => 
  import("@/components/landing/FeatureShowcase").then(m => ({ default: m.FeatureShowcase }))
);
const Footer = lazy(() => 
  import("@/components/landing/Footer").then(m => ({ default: m.Footer }))
);

// Skeleton fallback for lazy sections
const SectionSkeleton = () => (
  <div className="w-full py-16 px-4">
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-10 w-2/3 mx-auto bg-white/5" />
      <Skeleton className="h-6 w-1/2 mx-auto bg-white/5" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-52 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  </div>
);

const Landing = () => {
  const navigate = useNavigate();
  const { dir } = useLanguage();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        navigate('/app/dashboard');
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen w-full bg-[#0A0A0F] flex flex-col relative" dir={dir}>
      {/* Unified Ambient Background - spans entire page for smooth transitions */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        {/* Primary ambient glow - centered top */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1200px] h-[1200px] bg-blue-600/5 rounded-full blur-[200px]" />
        {/* Secondary glow - flows through middle sections */}
        <div className="absolute top-[40%] left-[-10%] w-[800px] h-[800px] bg-purple-600/4 rounded-full blur-[180px]" />
        <div className="absolute top-[60%] right-[-10%] w-[800px] h-[800px] bg-blue-600/4 rounded-full blur-[180px]" />
        {/* Bottom ambient for footer blend */}
        <div className="absolute bottom-[-10%] left-1/3 w-[600px] h-[600px] bg-purple-600/3 rounded-full blur-[150px]" />
      </div>
      
      <Navbar />
      <main className="flex-1 pt-16 relative z-10">
        <HeroSection />
        <Suspense fallback={<SectionSkeleton />}>
          <HowItWorksSection />
        </Suspense>
        <Suspense fallback={<SectionSkeleton />}>
          <FeatureShowcase />
        </Suspense>
      </main>
      <Suspense fallback={<div className="h-32" />}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default Landing;

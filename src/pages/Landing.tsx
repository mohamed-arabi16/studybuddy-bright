import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeatureShowcase } from "@/components/landing/FeatureShowcase";
import { Footer } from "@/components/landing/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

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
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col relative overflow-hidden" dir={dir}>
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
        <HowItWorksSection />
        <FeatureShowcase />
      </main>
      <Footer />
    </div>
  );
};

export default Landing;

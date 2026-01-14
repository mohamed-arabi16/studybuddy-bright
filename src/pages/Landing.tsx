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
      {/* Global Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-blue-600/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-600/6 rounded-full blur-[120px]" />
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

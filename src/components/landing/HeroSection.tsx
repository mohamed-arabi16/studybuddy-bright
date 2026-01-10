import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, BookOpen, Lightbulb, PenTool, Target, Clock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FloatingIcon = ({ 
  children, 
  className = "",
  delay = "0s",
  duration = "6s"
}: { 
  children: React.ReactNode; 
  className?: string;
  delay?: string;
  duration?: string;
}) => (
  <div 
    className={`absolute opacity-[0.12] text-primary pointer-events-none ${className}`}
    style={{
      animation: `float ${duration} ease-in-out infinite`,
      animationDelay: delay,
    }}
  >
    {children}
  </div>
);

export const HeroSection = () => {
  const { t, dir } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden" dir={dir}>
      {/* Floating keyframe animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(3deg); }
        }
      `}</style>

      {/* Blurry Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-primary/6 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/4 w-[200px] h-[200px] bg-primary/4 rounded-full blur-[60px]" />
      </div>

      {/* Floating Study Icons */}
      <FloatingIcon className="top-[12%] left-[8%] hidden md:block" delay="0s" duration="7s">
        <BookOpen size={52} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[18%] right-[10%] hidden md:block" delay="1.2s" duration="8s">
        <Lightbulb size={44} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[20%] left-[6%] hidden md:block" delay="2.5s" duration="6.5s">
        <Target size={40} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[25%] right-[8%] hidden md:block" delay="0.8s" duration="9s">
        <PenTool size={36} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[45%] left-[15%] hidden lg:block" delay="3.2s" duration="7.5s">
        <Clock size={32} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[38%] right-[14%] hidden lg:block" delay="1.8s" duration="8.5s">
        <Sparkles size={38} strokeWidth={1} />
      </FloatingIcon>

      {/* Content */}
      <div className="container relative z-10 px-4 py-24">
        <div className="flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full liquid-glass-subtle text-sm font-medium text-muted-foreground animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>{t('heroBadge')}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.1] animate-fade-in" style={{ animationDelay: '0.1s' }}>
            {t('heroTitle1')}
            <br />
            <span className="text-primary">{t('heroTitle2')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-muted-foreground max-w-xl animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {t('heroSubtitle')}
          </p>

          {/* Single CTA */}
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <Link to="/auth">
              <Button 
                size="lg" 
                className="gap-2 h-12 px-8 text-base"
              >
                {t('startNowFree')}
                <ArrowIcon className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

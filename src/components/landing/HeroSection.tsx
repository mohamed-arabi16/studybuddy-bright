import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, BookOpen, Brain, GraduationCap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo } from "react";

// Static CSS-based floating particle - no JS animations
const FloatingParticle = ({ size, x, y, delay }: { 
  size: number;
  x: number;
  y: number;
  delay: number;
}) => (
  <div
    className="absolute rounded-full bg-primary/20 animate-pulse"
    style={{ 
      width: size, 
      height: size, 
      left: `${x}%`, 
      top: `${y}%`,
      animationDelay: `${delay}s`,
      animationDuration: '4s',
    }}
  />
);

// Static floating icon - CSS only, no framer-motion
const FloatingIcon = ({ 
  children, 
  className = "",
}: { 
  children: React.ReactNode; 
  className?: string;
}) => (
  <div 
    className={`absolute text-primary/10 pointer-events-none animate-pulse ${className}`}
    style={{ animationDuration: '6s' }}
  >
    {children}
  </div>
);

// Static glowing orb - no animation, just blur
const GlowingOrb = ({ color, size, x, y }: { 
  color: string; 
  size: number; 
  x: number; 
  y: number;
}) => (
  <div
    className="absolute rounded-full blur-[120px]"
    style={{
      background: color,
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
      opacity: 0.3,
    }}
  />
);

// Static stat display - no counter animation
const StatNumber = ({ value, suffix, label }: { value: number; suffix: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
      {value.toLocaleString()}{suffix}
    </div>
    <div className="text-sm text-muted-foreground">{label}</div>
  </div>
);

export const HeroSection = () => {
  const { t, dir, language } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // Reduced particles - only 6 instead of 20
  const particles = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({
      id: i,
      delay: i * 0.5,
      size: 4 + (i % 3) * 2,
      x: 10 + (i * 15) % 80,
      y: 15 + (i * 12) % 70,
    })), []);

  const stats = useMemo(() => [
    { value: 500, label: language === 'ar' ? 'طالب نشط' : 'Active Students', suffix: '+' },
    { value: 95, label: language === 'ar' ? 'نسبة النجاح' : 'Success Rate', suffix: '%' },
    { value: 10000, label: language === 'ar' ? 'ساعة مذاكرة' : 'Study Hours', suffix: '+' },
  ], [language]);

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden" dir={dir}>
      {/* Static gradient mesh background - reduced orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <GlowingOrb color="rgba(59, 130, 246, 0.25)" size={800} x={50} y={-20} />
        <GlowingOrb color="rgba(147, 51, 234, 0.2)" size={600} x={70} y={60} />
        <GlowingOrb color="rgba(59, 130, 246, 0.15)" size={500} x={10} y={40} />
      </div>

      {/* Static grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Reduced floating particles - CSS only */}
      {particles.map((p) => (
        <FloatingParticle key={p.id} {...p} />
      ))}

      {/* Reduced floating icons - only 3, CSS only */}
      <FloatingIcon className="top-[15%] left-[8%] hidden md:block">
        <BookOpen size={56} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[20%] right-[12%] hidden md:block">
        <Brain size={48} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[20%] right-[10%] hidden md:block">
        <GraduationCap size={50} strokeWidth={1} />
      </FloatingIcon>

      {/* Content - CSS animations only */}
      <div className="container relative z-10 px-4 py-24">
        <div className="flex flex-col items-center text-center space-y-10 max-w-4xl mx-auto">
          {/* Badge - CSS animation */}
          <div 
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full liquid-glass border border-primary/20 text-sm font-medium animate-fade-in"
          >
            <Sparkles className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">
              {t('heroBadge')}
            </span>
          </div>

          {/* Main Heading - CSS animation */}
          <div className="space-y-2 mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.15]">
              <span className="block text-foreground">{t('heroTitle1')}</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
                {t('heroTitle2')}
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p 
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed animate-fade-in"
            style={{ animationDelay: '0.2s' }}
          >
            {t('heroSubtitle')}
          </p>

          {/* CTA Button */}
          <div 
            className="flex flex-col sm:flex-row gap-4 mt-4 animate-fade-in"
            style={{ animationDelay: '0.3s' }}
          >
            <Link to="/auth">
              <Button 
                size="lg" 
                className="gap-3 h-14 px-10 text-lg font-semibold shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-shadow"
              >
                {t('startNowFree')}
                <ArrowIcon className="w-5 h-5" />
              </Button>
            </Link>
          </div>

          {/* Stats - Static, no counter animation */}
          <div 
            className="grid grid-cols-3 gap-8 md:gap-16 mt-12 pt-12 border-t border-border/20 animate-fade-in"
            style={{ animationDelay: '0.4s' }}
          >
            {stats.map((stat) => (
              <StatNumber key={stat.label} {...stat} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-transparent pointer-events-none" />
    </section>
  );
};

import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, BookOpen, Brain, GraduationCap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useMemo, useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";

// Animated floating particle with motion
const FloatingParticle = ({ size, x, y, delay }: { 
  size: number;
  x: number;
  y: number;
  delay: number;
}) => (
  <motion.div
    className="absolute rounded-full bg-primary/20"
    style={{ 
      width: size, 
      height: size, 
      left: `${x}%`, 
      top: `${y}%`,
    }}
    animate={{
      y: [0, -20, 0],
      opacity: [0.5, 1, 0.5],
      scale: [1, 1.2, 1],
    }}
    transition={{
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut",
      delay: delay,
    }}
  />
);

// Animated floating icon with motion
const FloatingIcon = ({ 
  children, 
  className = "",
}: { 
  children: React.ReactNode; 
  className?: string;
}) => (
  <motion.div
    className={`absolute text-primary/10 pointer-events-none ${className}`}
    animate={{
      y: [0, -15, 0],
      rotate: [0, 5, -5, 0],
    }}
    transition={{
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  >
    {children}
  </motion.div>
);

// Animated glowing orb
const GlowingOrb = ({ color, size, x, y, duration = 10 }: {
  color: string; 
  size: number; 
  x: number; 
  y: number;
  duration?: number;
}) => (
  <motion.div
    className="absolute rounded-full blur-[120px]"
    style={{
      background: color,
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
      opacity: 0.3,
    }}
    animate={{
      scale: [1, 1.1, 1],
      opacity: [0.3, 0.4, 0.3],
    }}
    transition={{
      duration: duration,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Animated counter for stats
const AnimatedCounter = ({ value, suffix, label }: { value: number; suffix: string; label: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (isInView) {
      // Animate count from 0 to value
      const duration = 2000;
      const steps = 60;
      const increment = value / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += increment;
        if (current >= value) {
          setCount(value);
          clearInterval(timer);
        } else {
          setCount(Math.floor(current));
        }
      }, duration / steps);
      return () => clearInterval(timer);
    }
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
};

export const HeroSection = () => {
  const { t, dir, language } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

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
    <section ref={sectionRef} className="relative min-h-[100vh] flex items-center justify-center overflow-hidden" dir={dir}>
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 overflow-hidden">
        <GlowingOrb color="rgba(59, 130, 246, 0.25)" size={800} x={50} y={-20} />
        <GlowingOrb color="rgba(147, 51, 234, 0.2)" size={600} x={70} y={60} duration={12} />
        <GlowingOrb color="rgba(59, 130, 246, 0.15)" size={500} x={10} y={40} duration={15} />
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

      {/* Animated floating particles */}
      {particles.map((p) => (
        <FloatingParticle key={p.id} {...p} />
      ))}

      {/* Animated floating icons */}
      <FloatingIcon className="top-[15%] left-[8%] hidden md:block">
        <BookOpen size={56} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[20%] right-[12%] hidden md:block">
        <Brain size={48} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[20%] right-[10%] hidden md:block">
        <GraduationCap size={50} strokeWidth={1} />
      </FloatingIcon>

      {/* Content */}
      <div className="container relative z-10 px-4 py-24">
        <div className="flex flex-col items-center text-center space-y-10 max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full liquid-glass border border-primary/20 text-sm font-medium"
          >
            <Sparkles className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: '3s' }} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">
              {t('heroBadge')}
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="space-y-2 mb-4"
          >
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.15]">
              <span className="block text-foreground">{t('heroTitle1')}</span>
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 pb-2">
                {t('heroTitle2')}
              </span>
            </h1>
          </motion.div>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed"
          >
            {t('heroSubtitle')}
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 mt-4"
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
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7, delay: 0.8 }}
            className="grid grid-cols-3 gap-8 md:gap-16 mt-12 pt-12 border-t border-border/20"
          >
            {stats.map((stat) => (
              <AnimatedCounter key={stat.label} {...stat} />
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-transparent pointer-events-none" />
    </section>
  );
};

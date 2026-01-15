import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeft, BookOpen, Lightbulb, PenTool, Target, Clock, Sparkles, Brain, GraduationCap, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

// Floating particle component
const FloatingParticle = ({ delay, duration, size, x, y }: { 
  delay: number; 
  duration: number; 
  size: number;
  x: number;
  y: number;
}) => (
  <motion.div
    className="absolute rounded-full bg-primary/20"
    style={{ width: size, height: size, left: `${x}%`, top: `${y}%` }}
    animate={{
      y: [0, -30, 0],
      x: [0, 10, -10, 0],
      opacity: [0.1, 0.4, 0.1],
      scale: [1, 1.2, 1],
    }}
    transition={{
      duration: duration,
      delay: delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

// Animated number counter
const AnimatedCounter = ({ value, duration = 2 }: { value: number; duration?: number }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const animation = animate(count, value, { duration });
    const unsubscribe = rounded.on("change", (v) => setDisplayValue(v));
    return () => {
      animation.stop();
      unsubscribe();
    };
  }, [value, duration, count, rounded]);

  return <span>{displayValue.toLocaleString()}</span>;
};

// Floating icon with enhanced animation
const FloatingIcon = ({ 
  children, 
  className = "",
  delay = 0,
  x = 0,
  y = 0,
}: { 
  children: React.ReactNode; 
  className?: string;
  delay?: number;
  x?: number;
  y?: number;
}) => (
  <motion.div 
    className={`absolute text-primary pointer-events-none ${className}`}
    initial={{ opacity: 0, scale: 0 }}
    animate={{ 
      opacity: [0.08, 0.15, 0.08],
      scale: [1, 1.1, 1],
      y: [y, y - 20, y],
      x: [x, x + 5, x],
      rotate: [0, 5, -5, 0],
    }}
    transition={{
      duration: 6 + delay,
      delay: delay * 0.5,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  >
    {children}
  </motion.div>
);

// Glowing orb component - reduced opacity for softer blending
const GlowingOrb = ({ color, size, x, y, delay }: { 
  color: string; 
  size: number; 
  x: number; 
  y: number;
  delay: number;
}) => (
  <motion.div
    className="absolute rounded-full blur-[120px]"
    style={{
      background: color,
      width: size,
      height: size,
      left: `${x}%`,
      top: `${y}%`,
    }}
    animate={{
      scale: [1, 1.3, 1],
      opacity: [0.2, 0.4, 0.2],
    }}
    transition={{
      duration: 8,
      delay: delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  />
);

export const HeroSection = () => {
  const { t, dir, language } = useLanguage();
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  // Generate stable particles using useMemo
  const particles = useMemo(() => 
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: i * 0.3,
      duration: 4 + (i % 3) * 2,
      size: 4 + (i % 4) * 2,
      x: 5 + (i * 4.5) % 90,
      y: 10 + (i * 7) % 80,
    })), []);

  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden" dir={dir}>
      {/* Animated gradient mesh background - softer colors */}
      <div className="absolute inset-0 overflow-hidden">
        <GlowingOrb color="rgba(59, 130, 246, 0.25)" size={800} x={50} y={-20} delay={0} />
        <GlowingOrb color="rgba(147, 51, 234, 0.2)" size={600} x={70} y={60} delay={2} />
        <GlowingOrb color="rgba(59, 130, 246, 0.15)" size={500} x={10} y={40} delay={4} />
        <GlowingOrb color="rgba(236, 72, 153, 0.1)" size={400} x={80} y={20} delay={1} />
      </div>

      {/* Animated grid pattern */}
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

      {/* Floating particles */}
      {particles.map((p) => (
        <FloatingParticle key={p.id} {...p} />
      ))}

      {/* Enhanced Floating Study Icons */}
      <FloatingIcon className="top-[15%] left-[8%] hidden md:block" delay={0}>
        <BookOpen size={56} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[20%] right-[12%] hidden md:block" delay={1.5}>
        <Brain size={48} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[25%] left-[5%] hidden md:block" delay={2}>
        <Target size={44} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="bottom-[20%] right-[10%] hidden md:block" delay={0.8}>
        <GraduationCap size={50} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[50%] left-[12%] hidden lg:block" delay={2.5}>
        <Lightbulb size={40} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[40%] right-[15%] hidden lg:block" delay={1}>
        <Calendar size={42} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[70%] left-[20%] hidden lg:block" delay={3}>
        <PenTool size={36} strokeWidth={1} />
      </FloatingIcon>
      <FloatingIcon className="top-[65%] right-[20%] hidden lg:block" delay={1.8}>
        <Clock size={38} strokeWidth={1} />
      </FloatingIcon>

      {/* Content */}
      <div className="container relative z-10 px-4 py-24">
        <div className="flex flex-col items-center text-center space-y-10 max-w-4xl mx-auto">
          {/* Animated Badge */}
          <motion.div 
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full liquid-glass border border-primary/20 text-sm font-medium"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
            </motion.div>
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-semibold">
              {t('heroBadge')}
            </span>
          </motion.div>

          {/* Main Heading with staggered word animation */}
          <motion.div className="space-y-2">
            <motion.h1 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, type: "spring", stiffness: 80 }}
            >
              <span className="block text-foreground">{t('heroTitle1')}</span>
              <motion.span 
                className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400"
                animate={{ 
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                style={{ backgroundSize: "200% 200%" }}
              >
                {t('heroTitle2')}
              </motion.span>
            </motion.h1>
          </motion.div>

          {/* Subtitle with fade-in effect */}
          <motion.p 
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, type: "spring", stiffness: 80 }}
          >
            {t('heroSubtitle')}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 mt-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, type: "spring", stiffness: 80 }}
          >
            <Link to="/auth">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button 
                  size="lg" 
                  className="gap-3 h-14 px-10 text-lg font-semibold shadow-2xl shadow-primary/25 hover:shadow-primary/40 transition-shadow"
                >
                  {t('startNowFree')}
                  <motion.div
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowIcon className="w-5 h-5" />
                  </motion.div>
                </Button>
              </motion.div>
            </Link>
          </motion.div>

          {/* Animated Stats */}
          <motion.div 
            className="grid grid-cols-3 gap-8 md:gap-16 mt-12 pt-12 border-t border-border/20"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            {[
              { value: 500, label: language === 'ar' ? 'طالب نشط' : 'Active Students', suffix: '+' },
              { value: 95, label: language === 'ar' ? 'نسبة النجاح' : 'Success Rate', suffix: '%' },
              { value: 10000, label: language === 'ar' ? 'ساعة مذاكرة' : 'Study Hours', suffix: '+' },
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                  <AnimatedCounter value={stat.value} duration={2 + index * 0.5} />
                  <span>{stat.suffix}</span>
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade - taller for smoother blend */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/70 to-transparent pointer-events-none" />
    </section>
  );
};

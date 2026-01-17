import { BookOpen, Brain, Target, TrendingUp, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { motion, useInView, Variants } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export const HowItWorksSection = () => {
  const { t, dir } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const isMobile = useIsMobile();
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const handleCardTap = useCallback((key: string) => {
    if (isMobile) {
      setActiveCard(prev => prev === key ? null : key);
    }
  }, [isMobile]);

  const steps = [
    {
      icon: BookOpen,
      number: "01",
      titleKey: 'step1Title',
      descKey: 'step1Desc',
      hoverColor: "rgba(59, 130, 246, 0.12)",
      iconColor: "text-blue-400"
    },
    {
      icon: Brain,
      number: "02", 
      titleKey: 'step2Title',
      descKey: 'step2Desc',
      hoverColor: "rgba(168, 85, 247, 0.12)",
      iconColor: "text-purple-400"
    },
    {
      icon: Target,
      number: "03",
      titleKey: 'step3Title',
      descKey: 'step3Desc',
      hoverColor: "rgba(34, 197, 94, 0.12)",
      iconColor: "text-green-400"
    },
    {
      icon: TrendingUp,
      number: "04",
      titleKey: 'step4Title',
      descKey: 'step4Desc',
      hoverColor: "rgba(6, 182, 212, 0.12)",
      iconColor: "text-cyan-400"
    }
  ];

  // Animation variants with proper typing
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section id="how-it-works" ref={sectionRef} className="py-32 relative overflow-hidden" dir={dir}>
      {/* Top gradient fade for smooth transition from hero */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#0A0A0F] via-[#0A0A0F]/50 to-transparent pointer-events-none" />

      {/* Animated Background Elements - softer for better blending */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          className="absolute top-1/4 left-[-10%] w-[500px] h-[500px] bg-blue-600/6 rounded-full blur-[150px]"
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.06, 0.1, 0.06],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-[-10%] w-[500px] h-[500px] bg-purple-600/6 rounded-full blur-[150px]"
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.1, 0.06, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
      </div>

      {/* Connecting Line (Desktop) */}
      <div className="hidden lg:block absolute top-[50%] left-[10%] right-[10%] h-[2px]">
        <motion.div 
          className="h-full bg-gradient-to-r from-transparent via-primary/20 to-transparent"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />
      </div>

      <div className="container px-4 relative z-10">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-20"
          initial={{ opacity: 0, y: -30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full liquid-glass-subtle text-sm font-medium mb-6"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.2 }}
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{t('howItWorks')}</span>
          </motion.div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            {t('howItWorks')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">{t('howItWorksHighlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('howItWorksSubtitle')}
          </p>
        </motion.div>

        {/* Steps Grid */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 px-2 sm:px-0"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {steps.map((step, index) => {
            const isCardActive = activeCard === step.number;
            return (
              <motion.div 
                key={step.number} 
                variants={itemVariants}
                onTouchStart={() => handleCardTap(step.number)}
              >
                <LiquidGlassCard 
                  hover
                  disableAnimation
                  className="p-4 sm:p-5 md:p-6 relative h-full group border border-white/10"
                >
                  {/* Premium radial gradient background on hover - feathered edges */}
                  <div 
                    className={`absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500 ${
                      isCardActive || (!isMobile && 'group-hover:opacity-100')
                    } ${isCardActive ? 'opacity-100' : 'opacity-0'}`}
                    style={{
                      background: `radial-gradient(circle at center, ${step.hoverColor} 0%, transparent 70%)`,
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                    }}
                  />
                  
                  {/* Step number with glow */}
                  <div className="relative text-right">
                    <motion.span 
                      className="text-5xl sm:text-6xl font-bold text-primary/5 absolute -top-2 right-0 rtl:right-auto rtl:left-0"
                      animate={{ opacity: [0.03, 0.08, 0.03] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      {step.number}
                    </motion.span>
                    <span className="text-xs font-mono text-primary/60 mb-3 sm:mb-4 block relative">
                      {step.number}
                    </span>
                  </div>

                  {/* Icon with animated ring */}
                  <div className="relative mb-3 sm:mb-4 flex justify-end rtl:justify-start">
                    <motion.div 
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl backdrop-blur-md flex items-center justify-center ${step.iconColor}`}
                      style={{
                        background: `radial-gradient(circle at center, ${step.hoverColor} 0%, transparent 100%)`,
                      }}
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <step.icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.5} />
                    </motion.div>
                    {/* Pulse ring */}
                    <motion.div 
                      className="absolute inset-0 rounded-2xl border-2 border-primary/20 w-12 h-12 sm:w-14 sm:h-14 right-0 rtl:right-auto rtl:left-0"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                    />
                  </div>

                  {/* Content */}
                  <h3 className="text-base sm:text-lg font-bold mb-1 sm:mb-2 text-foreground/90 relative text-right">{t(step.titleKey)}</h3>
                  <p className="text-muted-foreground leading-relaxed relative text-xs sm:text-sm text-right">
                    {t(step.descKey)}
                  </p>
                </LiquidGlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Bottom gradient fade for smooth transition */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/50 to-transparent pointer-events-none" />
    </section>
  );
};

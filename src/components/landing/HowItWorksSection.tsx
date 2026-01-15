import { BookOpen, Brain, Target, TrendingUp, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { motion, useInView, Variants } from "framer-motion";
import { useRef } from "react";

export const HowItWorksSection = () => {
  const { t, dir } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const steps = [
    {
      icon: BookOpen,
      number: "01",
      titleKey: 'step1Title',
      descKey: 'step1Desc',
      color: "from-blue-500/30 to-blue-600/10",
      iconColor: "text-blue-400"
    },
    {
      icon: Brain,
      number: "02", 
      titleKey: 'step2Title',
      descKey: 'step2Desc',
      color: "from-purple-500/30 to-purple-600/10",
      iconColor: "text-purple-400"
    },
    {
      icon: Target,
      number: "03",
      titleKey: 'step3Title',
      descKey: 'step3Desc',
      color: "from-green-500/30 to-green-600/10",
      iconColor: "text-green-400"
    },
    {
      icon: TrendingUp,
      number: "04",
      titleKey: 'step4Title',
      descKey: 'step4Desc',
      color: "from-orange-500/30 to-orange-600/10",
      iconColor: "text-orange-400"
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
    <section ref={sectionRef} className="py-32 relative overflow-hidden" dir={dir}>
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
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-8"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {steps.map((step, index) => (
            <motion.div key={step.number} variants={itemVariants}>
              <LiquidGlassCard 
                hover
                disableAnimation
                className="p-8 relative h-full group"
              >
                {/* Gradient background on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl`} />
                
                {/* Step number with glow */}
                <div className="relative">
                  <motion.span 
                    className="text-7xl font-bold text-primary/5 absolute -top-4 -left-2"
                    animate={{ opacity: [0.03, 0.08, 0.03] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    {step.number}
                  </motion.span>
                  <span className="text-xs font-mono text-primary/60 mb-6 block relative">
                    {step.number}
                  </span>
                </div>

                {/* Icon with animated ring */}
                <div className="relative mb-6">
                  <motion.div 
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} backdrop-blur-md flex items-center justify-center ${step.iconColor}`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <step.icon className="w-8 h-8" strokeWidth={1.5} />
                  </motion.div>
                  {/* Pulse ring */}
                  <motion.div 
                    className={`absolute inset-0 rounded-2xl border-2 border-primary/20`}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3 text-foreground/90 relative">{t(step.titleKey)}</h3>
                <p className="text-muted-foreground leading-relaxed relative">
                  {t(step.descKey)}
                </p>
              </LiquidGlassCard>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade for smooth transition */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/50 to-transparent pointer-events-none" />
    </section>
  );
};

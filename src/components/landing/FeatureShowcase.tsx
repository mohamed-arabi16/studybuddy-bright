import { 
  LayoutDashboard, Calendar, Timer, BarChart3, Sparkles, Zap
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export const FeatureShowcase = () => {
  const { t, dir } = useLanguage();
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });

  const features = [
    {
      icon: LayoutDashboard,
      titleKey: 'feature1Title',
      descKey: 'feature1Desc',
      color: "from-blue-500 to-blue-600",
      hoverColor: "rgba(59, 130, 246, 0.12)",
      delay: 0
    },
    {
      icon: Calendar,
      titleKey: 'feature2Title',
      descKey: 'feature2Desc',
      color: "from-purple-500 to-purple-600",
      hoverColor: "rgba(168, 85, 247, 0.12)",
      delay: 0.1
    },
    {
      icon: Timer,
      titleKey: 'feature3Title',
      descKey: 'feature3Desc',
      color: "from-green-500 to-green-600",
      hoverColor: "rgba(34, 197, 94, 0.12)",
      delay: 0.2
    },
    {
      icon: BarChart3,
      titleKey: 'feature5Title',
      descKey: 'feature5Desc',
      color: "from-cyan-500 to-cyan-600",
      hoverColor: "rgba(6, 182, 212, 0.12)",
      delay: 0.3
    }
  ];

  return (
    <section ref={sectionRef} className="py-32 relative overflow-hidden" dir={dir}>
      {/* Top gradient fade for smooth transition */}
      <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-[#0A0A0F] via-[#0A0A0F]/50 to-transparent pointer-events-none" />

      {/* Animated Background Elements - softer intensities */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div 
          className="absolute top-1/3 right-[-15%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[180px]"
          animate={{ 
            x: [0, 50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div 
          className="absolute bottom-1/3 left-[-15%] w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[180px]"
          animate={{ 
            x: [0, -50, 0],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 15, repeat: Infinity }}
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
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">{t('featuresTitle')}</span>
          </motion.div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
            {t('featuresTitle')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">{t('featuresTitleHighlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            {t('featuresSubtitle')}
          </p>
        </motion.div>

        {/* Features Grid - 2x2 with enhanced cards */}
        <div className="grid sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {features.map((feature, index) => (
            <motion.div
              key={feature.titleKey}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.95 }}
              transition={{ 
                duration: 0.5, 
                delay: feature.delay + 0.3,
                type: "spring",
                stiffness: 100,
              }}
            >
              <LiquidGlassCard
                hover
                disableAnimation
                className="p-8 h-full group relative overflow-hidden border border-white/10"
              >
                {/* Premium radial gradient overlay on hover - feathered edges */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none"
                  style={{
                    background: `radial-gradient(circle at center, ${feature.hoverColor} 0%, transparent 70%)`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                  }}
                />

                {/* Decorative corner glow - subtle */}
                <motion.div 
                  className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${feature.color} rounded-full blur-[100px] opacity-0 group-hover:opacity-15 transition-opacity duration-500`}
                />

                {/* Icon with animated background */}
                <div className="relative mb-6 flex justify-end rtl:justify-start">
                  <motion.div 
                    className="w-16 h-16 rounded-2xl backdrop-blur-md flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle at center, ${feature.hoverColor} 0%, transparent 100%)`,
                    }}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <feature.icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
                  </motion.div>
                  
                  {/* Animated ring */}
                  <motion.div 
                    className="absolute rounded-2xl border border-primary/30 w-16 h-16 right-0 rtl:right-auto rtl:left-0"
                    animate={{ 
                      scale: [1, 1.15, 1],
                      opacity: [0.3, 0, 0.3],
                    }}
                    transition={{ duration: 2.5, repeat: Infinity, delay: index * 0.3 }}
                  />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold mb-3 text-foreground/90 relative text-right">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-muted-foreground leading-relaxed relative text-right">
                  {t(feature.descKey)}
                </p>

                {/* Bottom line accent */}
                <motion.div 
                  className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </LiquidGlassCard>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div 
          className="text-center mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.8 }}
        >
          <motion.div 
            className="inline-flex items-center gap-2 text-primary text-sm font-medium"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('heroBadge')}</span>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade for smooth transition to footer */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0A0A0F] to-transparent pointer-events-none" />
    </section>
  );
};

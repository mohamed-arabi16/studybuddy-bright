import { BookOpen, Brain, Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { motion } from "framer-motion";

export const HowItWorksSection = () => {
  const { t, dir } = useLanguage();

  const steps = [
    {
      icon: BookOpen,
      number: "01",
      titleKey: 'step1Title',
      descKey: 'step1Desc',
      color: "bg-blue-500/20"
    },
    {
      icon: Brain,
      number: "02", 
      titleKey: 'step2Title',
      descKey: 'step2Desc',
      color: "bg-purple-500/20"
    },
    {
      icon: Target,
      number: "03",
      titleKey: 'step3Title',
      descKey: 'step3Desc',
      color: "bg-green-500/20"
    },
    {
      icon: TrendingUp,
      number: "04",
      titleKey: 'step4Title',
      descKey: 'step4Desc',
      color: "bg-orange-500/20"
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden" dir={dir}>
      {/* Ambient Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-[-5%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-[-5%] w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="container px-4 relative z-10">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">
            {t('howItWorks')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">{t('howItWorksHighlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('howItWorksSubtitle')}
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <LiquidGlassCard 
              key={step.number}
              hover
              delay={index * 0.15}
              className="p-6 relative"
            >
              {/* Number */}
              <span className="text-xs font-mono text-gray-500 opacity-60 mb-4 block">
                {step.number}
              </span>

              {/* Icon */}
              <div className={`w-12 h-12 rounded-2xl ${step.color} backdrop-blur-md flex items-center justify-center text-primary mb-4`}>
                <step.icon className="w-6 h-6" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-2 text-white/90">{t(step.titleKey)}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t(step.descKey)}
              </p>
            </LiquidGlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

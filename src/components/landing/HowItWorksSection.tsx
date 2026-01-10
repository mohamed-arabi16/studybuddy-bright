import { BookOpen, Brain, Target, TrendingUp } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";

export const HowItWorksSection = () => {
  const { t, dir } = useLanguage();

  const steps = [
    {
      icon: BookOpen,
      number: "01",
      titleKey: 'step1Title',
      descKey: 'step1Desc'
    },
    {
      icon: Brain,
      number: "02", 
      titleKey: 'step2Title',
      descKey: 'step2Desc'
    },
    {
      icon: Target,
      number: "03",
      titleKey: 'step3Title',
      descKey: 'step3Desc'
    },
    {
      icon: TrendingUp,
      number: "04",
      titleKey: 'step4Title',
      descKey: 'step4Desc'
    }
  ];

  return (
    <section className="py-24 relative" dir={dir}>
      <div className="container px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">
            {t('howItWorks')} <span className="text-primary">{t('howItWorksHighlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('howItWorksSubtitle')}
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <LiquidGlassCard 
              key={step.number}
              hover
              className="p-6 relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Number */}
              <span className="text-xs font-medium text-primary mb-4 block">
                {step.number}
              </span>

              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <step.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-medium mb-2">{t(step.titleKey)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(step.descKey)}
              </p>
            </LiquidGlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

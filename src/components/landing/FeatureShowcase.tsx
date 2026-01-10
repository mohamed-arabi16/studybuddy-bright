import { 
  LayoutDashboard, Calendar, Timer, BarChart3
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";

export const FeatureShowcase = () => {
  const { t, dir } = useLanguage();

  // Reduced to 4 core features
  const features = [
    {
      icon: LayoutDashboard,
      titleKey: 'feature1Title',
      descKey: 'feature1Desc'
    },
    {
      icon: Calendar,
      titleKey: 'feature2Title',
      descKey: 'feature2Desc'
    },
    {
      icon: Timer,
      titleKey: 'feature3Title',
      descKey: 'feature3Desc'
    },
    {
      icon: BarChart3,
      titleKey: 'feature5Title',
      descKey: 'feature5Desc'
    }
  ];

  return (
    <section className="py-24 relative" dir={dir}>
      <div className="container px-4">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-semibold mb-4">
            {t('featuresTitle')} <span className="text-primary">{t('featuresTitleHighlight')}</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t('featuresSubtitle')}
          </p>
        </div>

        {/* Features Grid - 2x2 */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {features.map((feature, index) => (
            <LiquidGlassCard
              key={feature.titleKey}
              hover
              className="p-6"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon - Single accent color */}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                <feature.icon className="w-5 h-5" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-medium mb-2">
                {t(feature.titleKey)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(feature.descKey)}
              </p>
            </LiquidGlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

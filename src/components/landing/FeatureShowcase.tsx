import { 
  LayoutDashboard, Calendar, Timer, BarChart3
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { LiquidGlassCard } from "@/components/ui/LiquidGlassCard";
import { motion } from "framer-motion";

export const FeatureShowcase = () => {
  const { t, dir } = useLanguage();

  // Reduced to 4 core features
  const features = [
    {
      icon: LayoutDashboard,
      titleKey: 'feature1Title',
      descKey: 'feature1Desc',
      color: "bg-blue-500/20"
    },
    {
      icon: Calendar,
      titleKey: 'feature2Title',
      descKey: 'feature2Desc',
      color: "bg-purple-500/20"
    },
    {
      icon: Timer,
      titleKey: 'feature3Title',
      descKey: 'feature3Desc',
      color: "bg-green-500/20"
    },
    {
      icon: BarChart3,
      titleKey: 'feature5Title',
      descKey: 'feature5Desc',
      color: "bg-orange-500/20"
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden" dir={dir}>
      {/* Ambient Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-[-10%] w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/3 left-[-10%] w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
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
            {t('featuresTitle')} <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">{t('featuresTitleHighlight')}</span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto">
            {t('featuresSubtitle')}
          </p>
        </motion.div>

        {/* Features Grid - 2x2 */}
        <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {features.map((feature, index) => (
            <LiquidGlassCard
              key={feature.titleKey}
              hover
              delay={index * 0.15}
              className="p-6"
            >
              {/* Icon - Colored background */}
              <div className={`w-12 h-12 rounded-2xl ${feature.color} backdrop-blur-md flex items-center justify-center text-primary mb-4`}>
                <feature.icon className="w-6 h-6" strokeWidth={1.5} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold mb-2 text-white/90">
                {t(feature.titleKey)}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t(feature.descKey)}
              </p>
            </LiquidGlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

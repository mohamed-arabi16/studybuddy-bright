import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";

export const Footer = () => {
  const { t, dir } = useLanguage();

  return (
    <footer className="py-8 border-t border-border/10" dir={dir}>
      <motion.div
        className="container px-4"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">StudyBuddy</span>
          </Link>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t('termsOfService')}
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t('privacyPolicy')}
            </Link>
            <Link to="/refund" className="hover:text-foreground transition-colors">
              {t('refundPolicy')}
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} StudyBuddy. {t('allRightsReserved')}
          </p>
        </div>
      </motion.div>
    </footer>
  );
};

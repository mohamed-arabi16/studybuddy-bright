import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

export const Footer = () => {
  const { t, dir } = useLanguage();

  return (
    <footer className="py-8 border-t border-border/10" dir={dir}>
      <div className="container px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="text-lg font-semibold">
            Zen Study
          </Link>

          {/* Legal Links */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t('termsOfService')}
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t('privacyPolicy')}
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Zen Study. {t('allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
};

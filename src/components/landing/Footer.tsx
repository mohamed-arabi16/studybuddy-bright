import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import studybudyLogo from "@/assets/studybudy-logo.png";

export const Footer = () => {
  const { t, dir } = useLanguage();

  return (
    <footer className="py-8 border-t border-border/10" dir={dir}>
      <div className="container px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={studybudyLogo} alt="StudyBudy" className="h-8 w-auto" />
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
            © {new Date().getFullYear()} StudyBudy. {t('allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  );
};

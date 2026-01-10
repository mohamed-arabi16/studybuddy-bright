import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useLanguage, LanguageToggle } from "@/contexts/LanguageContext";
import studybudyLogo from "@/assets/studybudy-logo.png";

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const { t, dir } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      dir={dir}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? 'liquid-glass border-b border-border/10' 
          : 'bg-transparent'
      }`}
    >
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={studybudyLogo} alt="StudyBudy" className="h-10 w-auto" />
        </Link>

        {/* Actions - Simplified */}
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/auth">
            <Button className="h-9 px-4">
              {t('startFree')}
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

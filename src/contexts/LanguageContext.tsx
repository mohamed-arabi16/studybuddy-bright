import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Cache loaded translations
const translationsCache: Record<Language, Record<string, string> | null> = {
  ar: null,
  en: null,
};

// Dynamic loader for translations
async function loadTranslations(lang: Language): Promise<Record<string, string>> {
  if (translationsCache[lang]) {
    return translationsCache[lang]!;
  }

  const module = lang === 'ar'
    ? await import('@/i18n/ar')
    : await import('@/i18n/en');

  translationsCache[lang] = module[lang];
  return module[lang];
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("study-buddy-language");
    return (saved as Language) || "ar";
  });

  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translations on language change
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    loadTranslations(language).then((trans) => {
      if (mounted) {
        setTranslations(trans);
        setIsLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("study-buddy-language", lang);
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[key] || key;
  };

  const dir = language === "ar" ? "rtl" : "ltr";

  // Show loading state or render with translations
  if (isLoading && Object.keys(translations).length === 0) {
    return <div className="min-h-screen bg-background" />; // Minimal fallback
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <button
      onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
      className="px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-sm font-medium transition-colors"
    >
      {language === "ar" ? "EN" : "عربي"}
    </button>
  );
}

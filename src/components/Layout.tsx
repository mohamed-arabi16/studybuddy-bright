import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Settings,
  LogOut,
  Menu,
  Shield,
  Languages,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Session } from "@supabase/supabase-js";
import { UsageIndicator } from "@/components/UsageIndicator";
import { CreditIndicator } from "@/components/CreditIndicator";
import { FeedbackForm } from "@/components/FeedbackForm";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [status, setStatus] = useState<"loading" | "authenticated" | "guest">("loading");
  const { language, setLanguage, t, dir } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    const checkUserStatus = async (userId: string) => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("is_disabled, profile_completed")
          .eq("user_id", userId)
          .maybeSingle();

        // P0: Zombie Session Fix - immediately block disabled users
        if (profileData?.is_disabled) {
          console.log("[Layout] User is disabled, signing out");
          await supabase.auth.signOut();
          navigate("/auth", { state: { accountDisabled: true } });
          setStatus("guest");
          return;
        }

        // Redirect to complete profile if not completed
        if (profileData && profileData.profile_completed === false) {
          navigate("/complete-profile", { replace: true });
          return;
        }

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        setIsAdmin(!!roleData);
        setStatus("authenticated");
      } catch (error) {
        console.error("Error checking user status:", error);
        setStatus("authenticated");
      }
    };

    // P0: Periodic disabled check (every 60 seconds)
    let disabledCheckInterval: NodeJS.Timeout | null = null;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only synchronous state updates here
        setSession(session);
        
        if (session) {
          // Defer Supabase calls to prevent deadlock
          setTimeout(() => {
            checkUserStatus(session.user.id);
          }, 0);
          
          // P0: Start periodic disabled check
          if (!disabledCheckInterval) {
            disabledCheckInterval = setInterval(() => {
              checkUserStatus(session.user.id);
            }, 60000); // Check every 60 seconds
          }
        } else {
          setIsAdmin(false);
          setStatus("guest");
          if (disabledCheckInterval) {
            clearInterval(disabledCheckInterval);
            disabledCheckInterval = null;
          }
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkUserStatus(session.user.id);
      } else {
        setStatus("guest");
      }
    });

    return () => {
      subscription.unsubscribe();
      if (disabledCheckInterval) {
        clearInterval(disabledCheckInterval);
      }
    };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const navItems = [
    { href: "/app/dashboard", icon: LayoutDashboard, label: t('dashboard') },
    { href: "/app/courses", icon: BookOpen, label: t('courses') },
    { href: "/app/plan", icon: Calendar, label: t('plan') },
    { href: "/app/settings", icon: Settings, label: t('settings') },
  ];

  if (isAdmin) {
    navItems.push({ href: "/admin", icon: Shield, label: t('admin') });
  }

  return (
    <div className="min-h-screen flex bg-[#0A0A0F] relative overflow-hidden" dir={dir}>
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-purple-600/6 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 right-1/4 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[80px]" />
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white/5 backdrop-blur-xl border-r border-white/10 p-6 space-y-6 relative z-10">
        <div className="flex items-center justify-between">
          <Link to="/app/dashboard" className="flex items-center gap-2 px-2">
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              StudyBudy
            </span>
          </Link>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-medium transition-colors w-full text-white/80"
        >
          <Languages size={18} />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-primary/20 text-primary font-medium border border-primary/30"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          
          {/* Feedback Form */}
          {session && <FeedbackForm language={language} />}
        </nav>

        {/* Credit Indicator - AI Usage */}
        {session && <CreditIndicator />}
        
        {/* Usage Indicator - Course Limits */}
        {session && <UsageIndicator />}

        {session ? (
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut size={20} className={language === 'ar' ? 'ml-3' : 'mr-3'} />
            {t('signOut')}
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to="/auth">{t('signIn')}</Link>
          </Button>
        )}
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="md:hidden flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl border-b border-white/10">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              StudyBudy
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages size={18} className="text-white/80" />
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side={language === 'ar' ? 'right' : 'left'} className="w-64 p-6 bg-[#0A0A0F]/95 backdrop-blur-xl border-white/10">
                <div className="flex flex-col h-full space-y-6">
                  <Link to="/app/dashboard" className="px-2">
                    <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                      StudyBudy
                    </span>
                  </Link>
                  <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all duration-200"
                      >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </nav>
                  {session ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-destructive"
                      onClick={handleSignOut}
                    >
                      <LogOut size={20} className={language === 'ar' ? 'ml-3' : 'mr-3'} />
                      {t('signOut')}
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="w-full justify-start">
                      <Link to="/auth">{t('signIn')}</Link>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {status === "loading" ? (
            <div className="text-center text-gray-400">{t('loading')}</div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
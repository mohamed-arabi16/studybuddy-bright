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

        if (profileData?.is_disabled) {
          await supabase.auth.signOut();
          navigate("/auth");
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
        } else {
          setIsAdmin(false);
          setStatus("guest");
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

    return () => subscription.unsubscribe();
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
    <div className="min-h-screen flex bg-background" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Link to="/app/dashboard" className="flex items-center gap-2 px-2">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              StudyBudy
            </span>
          </Link>
        </div>

        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors w-full"
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
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted"
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

        {/* Usage Indicator */}
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
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
          <Link to="/app/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              StudyBudy
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
              title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Languages size={18} />
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side={language === 'ar' ? 'right' : 'left'} className="w-64 p-6">
                <div className="flex flex-col h-full space-y-6">
                  <Link to="/app/dashboard" className="px-2">
                    <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      StudyBudy
                    </span>
                  </Link>
                  <nav className="flex-1 space-y-2">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-muted"
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
            <div className="text-center text-muted-foreground">{t('loading')}</div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
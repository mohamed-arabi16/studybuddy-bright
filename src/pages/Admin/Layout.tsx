import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Shield,
  MessageSquare,
  Menu,
  ArrowLeft,
  Languages,
  Gift,
  Coins,
  Receipt,
} from "lucide-react";

export default function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();
  const { t, dir, language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      // Check admin role from user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      // Only allow admin access if user has admin role
      setIsAdmin(!!roleData);
    }
    checkAdmin();
  }, []);

  if (isAdmin === null) return <div className="flex items-center justify-center min-h-screen">{t('loading')}</div>;
  if (isAdmin === false) return <Navigate to="/app" />;

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: t('adminOverview') },
    { href: "/admin/users", icon: Users, label: t('users') },
    { href: "/admin/plans", icon: CreditCard, label: t('plans') },
    { href: "/admin/promos", icon: Gift, label: t('promoCodes') },
    { href: "/admin/quotas", icon: Settings, label: t('quotas') },
    { href: "/admin/trials", icon: Shield, label: t('trials') },
    { href: "/admin/credits", icon: Coins, label: t('creditAnalytics') },
    { href: "/admin/refunds", icon: Receipt, label: t('refundManagement') },
    { href: "/admin/feedback", icon: MessageSquare, label: t('feedbackTitle') },
    { href: "/admin/audit", icon: Shield, label: t('auditLog') },
  ];

  const NavContent = () => (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">
          {t('superAdmin')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('monetizationControl')}
        </p>
      </div>
      
      {/* Language Toggle */}
      <button
        onClick={toggleLanguage}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors w-full mb-4"
      >
        <Languages size={18} />
        <span>{language === 'ar' ? 'English' : 'العربية'}</span>
      </button>

      {/* Back to App */}
      <Link to="/app/dashboard">
        <Button variant="outline" className="w-full justify-start mb-4 gap-2">
          <ArrowLeft className={`h-4 w-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          {t('backToApp')}
        </Button>
      </Link>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
          return (
            <Link key={item.href} to={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className={`h-4 w-4 ${dir === 'rtl' ? 'ml-2' : 'mr-2'}`} />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 bg-card border-e border-border min-h-screen p-4">
        <NavContent />
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
          <h1 className="text-lg font-bold text-foreground">
            {t('admin')}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            >
              <Languages size={18} />
            </button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu size={24} />
                </Button>
              </SheetTrigger>
              <SheetContent side={dir === 'rtl' ? 'right' : 'left'} className="w-64 p-4">
                <NavContent />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
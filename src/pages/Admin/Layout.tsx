import { Outlet, Navigate, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  Shield,
  MessageSquare,
} from "lucide-react";

export default function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const location = useLocation();

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

  if (isAdmin === null) return <div>Loading...</div>;
  if (isAdmin === false) return <Navigate to="/app" />;

  const navItems = [
    { href: "/admin", icon: LayoutDashboard, label: "Overview" },
    { href: "/admin/users", icon: Users, label: "Users" },
    { href: "/admin/plans", icon: CreditCard, label: "Plans" },
    { href: "/admin/quotas", icon: Settings, label: "Quotas" },
    { href: "/admin/trials", icon: Shield, label: "Trials" },
    { href: "/admin/feedback", icon: MessageSquare, label: "Feedback" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border min-h-screen p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Monetization & Control</p>
        </div>
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
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}
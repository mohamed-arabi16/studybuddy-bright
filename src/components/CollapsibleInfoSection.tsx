import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp, LucideIcon } from 'lucide-react';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { cn } from '@/lib/utils';

interface CollapsibleInfoSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string;
  badgeVariant?: 'default' | 'warning' | 'success' | 'destructive';
}

export function CollapsibleInfoSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = false,
  badge,
  badgeVariant = 'default'
}: CollapsibleInfoSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const badgeColors = {
    default: 'bg-muted text-muted-foreground',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <LiquidGlassCard className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
          <span className="font-medium text-sm">{title}</span>
          {badge && (
            <span className={cn(
              "text-xs px-2 py-0.5 rounded-full",
              badgeColors[badgeVariant]
            )}>
              {badge}
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {isOpen && (
        <div className="px-4 pb-4 pt-0">
          <div className="border-t border-border/20 pt-4">
            {children}
          </div>
        </div>
      )}
    </LiquidGlassCard>
  );
}

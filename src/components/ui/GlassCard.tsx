import { cn } from '@/lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
  glow?: boolean;
}

export function GlassCard({ 
  children, 
  className, 
  hover = false, 
  glow = false,
  ...props 
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-card/60 backdrop-blur-xl border border-border/50 shadow-lg',
        hover && 'transition-all duration-300 hover:shadow-xl hover:border-primary/30 hover:bg-card/80',
        glow && 'animate-pulse-glow',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

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
        'rounded-2xl bg-card/60 backdrop-blur-xl border border-border/50 shadow-lg relative overflow-hidden group',
        hover && 'transition-all duration-300 hover:shadow-xl hover:border-primary/30',
        glow && 'animate-pulse-glow',
        className
      )}
      {...props}
    >
      {/* Premium Liquid Glass hover effect - radial gradient with feathered edges */}
      {hover && (
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

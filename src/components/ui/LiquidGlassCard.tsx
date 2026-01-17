import { cn } from '@/lib/utils';
import { forwardRef, HTMLAttributes } from 'react';

export interface LiquidGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
  hover?: boolean;
  delay?: number;
  disableAnimation?: boolean;
}

const LiquidGlassCard = forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  ({ className, variant = 'default', hover = false, delay = 0, disableAnimation = false, children, style, ...props }, ref) => {
    const variantClasses = {
      default: 'liquid-glass',
      elevated: 'liquid-glass-elevated',
      subtle: 'liquid-glass-subtle'
    };

    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          'rounded-2xl relative overflow-hidden group',
          !disableAnimation && 'animate-fade-in',
          hover && 'hover:scale-[1.02] hover:-translate-y-1 active:scale-[0.98]',
          className
        )}
        style={{
          ...style,
          animationDelay: disableAnimation ? undefined : `${delay}s`,
          transition: hover ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
        }}
        {...props}
      >
        {/* Subtle shine effect gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />
        {/* Premium Liquid Glass hover effect - radial gradient with feathered edges */}
        {hover && (
          <div 
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100"
            style={{
              background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
              transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        )}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);

LiquidGlassCard.displayName = 'LiquidGlassCard';

export { LiquidGlassCard };

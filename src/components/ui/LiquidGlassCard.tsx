import { cn } from '@/lib/utils';
import { forwardRef, HTMLAttributes } from 'react';

export interface LiquidGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
  hover?: boolean;
}

const LiquidGlassCard = forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  ({ className, variant = 'default', hover = false, children, ...props }, ref) => {
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
          'rounded-2xl',
          hover && 'transition-all duration-200 ease-out-expo hover:-translate-y-0.5 hover:shadow-glass-elevated hover:border-primary/20',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

LiquidGlassCard.displayName = 'LiquidGlassCard';

export { LiquidGlassCard };

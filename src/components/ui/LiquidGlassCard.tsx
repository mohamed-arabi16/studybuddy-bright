import { cn } from '@/lib/utils';
import { forwardRef, HTMLAttributes, useState, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

export interface LiquidGlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
  hover?: boolean;
  delay?: number;
  disableAnimation?: boolean;
}

const LiquidGlassCard = forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  ({ className, variant = 'default', hover = false, delay = 0, disableAnimation = false, children, style, onTouchStart, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const isMobile = useIsMobile();
    const [isActive, setIsActive] = useState(false);

    const variantClasses = {
      default: 'liquid-glass',
      elevated: 'liquid-glass-elevated',
      subtle: 'liquid-glass-subtle'
    };

    // Touch-friendly hover for mobile
    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
      if (isMobile && hover) {
        setIsActive(prev => !prev);
      }
      onTouchStart?.(e);
    }, [isMobile, hover, onTouchStart]);

    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!isMobile && hover) {
        setIsActive(true);
      }
      onMouseEnter?.(e);
    }, [isMobile, hover, onMouseEnter]);

    const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (!isMobile && hover) {
        setIsActive(false);
      }
      onMouseLeave?.(e);
    }, [isMobile, hover, onMouseLeave]);

    // Determine if hover effect is active
    const showHoverEffect = hover && isActive;

    return (
      <div
        ref={ref}
        className={cn(
          variantClasses[variant],
          'rounded-2xl relative overflow-hidden',
          !disableAnimation && 'animate-fade-in',
          hover && 'cursor-pointer',
          // Only apply group-hover on desktop, use state-based for mobile
          !isMobile && hover && 'group',
          className
        )}
        style={{
          ...style,
          animationDelay: disableAnimation ? undefined : `${delay}s`,
          transition: hover ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          transform: showHoverEffect ? 'scale(1.02) translateY(-4px)' : undefined,
        }}
        onTouchStart={handleTouchStart}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Subtle shine effect gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />
        {/* Premium Liquid Glass hover effect - radial gradient with feathered edges */}
        {hover && (
          <div 
            className={cn(
              "absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-500",
              showHoverEffect ? "opacity-100" : "opacity-0",
              !isMobile && "group-hover:opacity-100"
            )}
            style={{
              background: 'radial-gradient(circle at center, hsl(var(--primary) / 0.12) 0%, transparent 70%)',
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

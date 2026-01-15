import { cn } from '@/lib/utils';
import { forwardRef, HTMLAttributes } from 'react';
import { motion, MotionProps, HTMLMotionProps } from 'framer-motion';

export interface LiquidGlassCardProps extends Omit<HTMLMotionProps<"div">, 'children'> {
  variant?: 'default' | 'elevated' | 'subtle';
  hover?: boolean;
  delay?: number;
  disableAnimation?: boolean;
  children?: React.ReactNode;
}

const LiquidGlassCard = forwardRef<HTMLDivElement, LiquidGlassCardProps>(
  ({ className, variant = 'default', hover = false, delay = 0, disableAnimation = false, children, style, ...props }, ref) => {
    const variantClasses = {
      default: 'liquid-glass',
      elevated: 'liquid-glass-elevated',
      subtle: 'liquid-glass-subtle'
    };

    const animationProps: MotionProps = disableAnimation ? {} : {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { 
        duration: 0.5, 
        delay: delay, 
        type: "spring", 
        stiffness: 120,
        damping: 20
      },
      whileHover: hover ? { 
        scale: 1.02, 
        boxShadow: "0px 10px 30px rgba(0,0,0,0.3)",
        y: -2
      } : undefined,
      whileTap: hover ? { scale: 0.98 } : undefined,
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          variantClasses[variant],
          'rounded-2xl relative overflow-hidden',
          className
        )}
        style={style}
        {...animationProps}
        {...props}
      >
        {/* Subtle shine effect gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-2xl" />
        <div className="relative z-10">{children}</div>
      </motion.div>
    );
  }
);

LiquidGlassCard.displayName = 'LiquidGlassCard';

export { LiquidGlassCard };

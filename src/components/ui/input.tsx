import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  glassEffect?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, glassEffect = false, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border px-3 py-2 text-base ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "transition-all duration-200",
          // Glass effect styling
          glassEffect 
            ? [
                "bg-white/5 border-white/10 backdrop-blur-xl",
                "focus:outline-none focus:border-primary/50 focus:bg-white/10",
                "focus:shadow-[0_0_20px_rgba(59,130,246,0.3)]",
              ]
            : [
                "border-input bg-background",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              ],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

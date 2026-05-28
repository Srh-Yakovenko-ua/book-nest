import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export type CardActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const CardActionButton = forwardRef<HTMLButtonElement, CardActionButtonProps>(
  function CardActionButton({ className, type = "button", ...props }, ref) {
    return (
      <button
        className={cn(
          "absolute top-3 right-3 z-10",
          "flex size-8 cursor-pointer items-center justify-center rounded-lg",
          "bg-black/30 text-white backdrop-blur-sm transition-all duration-150",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:outline-none",
          "hover:bg-black/50",
          "max-sm:opacity-100",
          className,
        )}
        ref={ref}
        type={type}
        {...props}
      />
    );
  },
);

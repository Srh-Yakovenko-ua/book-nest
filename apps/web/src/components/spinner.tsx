import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

type SpinnerProps = {
  className?: string;
  label?: string;
  size?: "lg" | "md" | "sm";
};

const SPINNER = {
  icon: "shrink-0 animate-spin motion-reduce:animate-none",
  size: {
    lg: "size-6",
    md: "size-4",
    sm: "size-3.5",
  },
  status: "inline-flex shrink-0",
} as const satisfies {
  icon: string;
  size: Record<NonNullable<SpinnerProps["size"]>, string>;
  status: string;
};

export function Spinner({ className, label, size = "md" }: SpinnerProps) {
  if (label === undefined) {
    return <Loader2 aria-hidden className={cn(SPINNER.icon, SPINNER.size[size], className)} />;
  }

  return (
    <span className={cn(SPINNER.status, className)} role="status">
      <Loader2 aria-hidden className={cn(SPINNER.icon, SPINNER.size[size])} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

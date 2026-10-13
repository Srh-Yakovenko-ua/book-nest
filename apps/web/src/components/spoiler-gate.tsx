import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type SpoilerGateProps = {
  action: ReactNode;
  className?: string;
  description: string;
  title: string;
  variant?: "compact" | "default";
};

const SPOILER_GATE_STYLES = {
  circle: "inline-flex shrink-0 items-center justify-center rounded-full bg-accent text-icon",
  container:
    "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/30 px-4 text-center",
  variants: {
    compact: { circle: "mb-1.5 size-8", container: "py-4", iconSize: 18 },
    default: { circle: "mb-2 size-9", container: "py-6 md:h-48", iconSize: 20 },
  },
} as const;

export function SpoilerGate({
  action,
  className,
  description,
  title,
  variant = "default",
}: SpoilerGateProps) {
  const styles = SPOILER_GATE_STYLES.variants[variant];

  return (
    <div className={cn(SPOILER_GATE_STYLES.container, styles.container, className)}>
      <span className={cn(SPOILER_GATE_STYLES.circle, styles.circle)}>
        <UiIcon name="eye-off" size={styles.iconSize} />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}

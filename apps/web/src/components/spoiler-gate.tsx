import type { ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type SpoilerGateProps = {
  action: ReactNode;
  className?: string;
  description: string;
  title: string;
};

export function SpoilerGate({ action, className, description, title }: SpoilerGateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-secondary/30 px-4 py-6 text-center md:h-48",
        className,
      )}
    >
      <span className="mb-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-icon">
        <UiIcon name="eye-off" size={20} />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import { type StatusEntry, type StatusTone } from "@/lib/book-status";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs leading-none font-semibold whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-muted-foreground",
        accent: "bg-accent text-icon",
        primary: "bg-accent text-icon",
        success: "bg-success-soft text-success",
        info: "bg-info-soft text-info",
        warning: "bg-warning-soft text-warning",
        danger: "bg-error-soft text-error",
      } satisfies Record<StatusTone, string>,
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

type StatusBadgeProps = Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof statusBadgeVariants> & {
    entry: StatusEntry;
    labelClassName?: string;
  };

function StatusBadge({ className, entry, labelClassName, tone, ...props }: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ tone: tone ?? entry.tone }), className)}
      data-slot="status-badge"
      data-tone={entry.tone}
      {...props}
    >
      <UiIcon name={entry.icon} />
      <span className={cn("truncate leading-normal", labelClassName)}>{entry.label}</span>
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };

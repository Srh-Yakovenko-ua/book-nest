"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon, type UiIconName } from "@/components/icons/ui-icon";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const statCardVariants = cva(
  "flex flex-row items-center gap-4 overflow-hidden border border-border bg-card shadow-card",
  {
    variants: {
      size: {
        default: "px-[22px] py-5",
        compact: "gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 sm:py-3.5",
      },
      interactive: {
        true: "cursor-pointer transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        false: "",
      },
    },
    defaultVariants: {
      size: "default",
      interactive: false,
    },
  },
);

const iconBadgeVariants = cva(
  "grid shrink-0 place-items-center rounded-full bg-accent [&_svg]:size-[26px]",
  {
    variants: {
      size: {
        default: "size-[54px]",
        compact: "size-10 sm:size-11 [&_svg]:size-5",
      },
      tone: {
        primary: "text-primary",
        ink: "text-icon",
      },
    },
    defaultVariants: {
      size: "default",
      tone: "primary",
    },
  },
);

const valueVariants = cva("font-heading leading-[1.12] font-bold text-ink tabular-nums", {
  variants: {
    size: {
      default: "text-[2rem]",
      compact: "text-2xl",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

type StatCardProps = Omit<React.ComponentProps<typeof Card>, "children" | "size"> &
  Pick<VariantProps<typeof statCardVariants>, "size"> & {
    caption?: React.ReactNode;
    icon: UiIconName;
    iconTone?: "ink" | "primary";
    label: React.ReactNode;
    trend?: StatTrend;
    value: React.ReactNode;
  };

type StatTrend = {
  direction: "down" | "up";
  label: React.ReactNode;
};

function StatCard({
  className,
  size = "default",
  icon,
  label,
  value,
  iconTone = "primary",
  caption,
  trend,
  onClick,
  ...props
}: StatCardProps) {
  const interactive = onClick !== undefined;

  return (
    <Card
      className={cn(statCardVariants({ size, interactive }), className)}
      data-slot="stat-card"
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.currentTarget.click();
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      {...props}
    >
      <span className={iconBadgeVariants({ size, tone: iconTone })}>
        <UiIcon name={icon} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-muted-foreground">{label}</span>
        <span className={valueVariants({ size })}>{value}</span>
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[0.8125rem] font-medium [&_svg]:size-3.5",
              trend.direction === "up" ? "text-success" : "text-error",
            )}
          >
            <UiIcon name={trend.direction === "up" ? "trend-up" : "trend-down"} />
            {trend.label}
          </span>
        ) : caption === undefined ? null : (
          <span className="text-[0.8125rem] text-muted-foreground">{caption}</span>
        )}
      </div>
    </Card>
  );
}

export { StatCard };
export type { StatTrend };

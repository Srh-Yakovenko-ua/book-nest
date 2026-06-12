"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const ringWrapVariants = cva("relative inline-grid place-items-center leading-none", {
  variants: {
    size: {
      sm: "size-16",
      md: "size-24",
      lg: "size-[8.375rem]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const ringSvgVariants = cva("size-full -rotate-90", {
  variants: {
    indeterminate: {
      true: "motion-safe:animate-spin",
      false: "",
    },
  },
  defaultVariants: {
    indeterminate: false,
  },
});

const ringValueVariants = cva(
  "font-heading leading-none font-bold tabular-nums transition-colors",
  {
    variants: {
      size: {
        sm: "text-[1.05rem]",
        md: "text-2xl",
        lg: "text-[2.1rem]",
      },
      tone: {
        primary: "text-ink",
        success: "text-success",
        warning: "text-warning",
        error: "text-error",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "primary",
    },
  },
);

const indicatorToneClass = {
  primary: "stroke-primary",
  success: "stroke-success",
  warning: "stroke-warning",
  error: "stroke-error",
} as const;

type RingProgressProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof ringWrapVariants> & {
    children?: React.ReactNode;
    indeterminate?: boolean;
    label?: React.ReactNode;
    max?: number;
    tone?: RingTone;
    value?: number;
  };

type RingTone = keyof typeof indicatorToneClass;

function RingProgress({
  className,
  size = "md",
  value = 0,
  max = 100,
  tone,
  indeterminate = false,
  label,
  children,
  "aria-label": ariaLabel,
  ...props
}: RingProgressProps) {
  const fraction = max <= 0 ? 0 : Math.min(Math.max(value / max, 0), 1);
  const percent = Math.round(fraction * 100);
  const isComplete = !indeterminate && fraction >= 1;
  const resolvedTone: RingTone = tone ?? (isComplete ? "success" : "primary");

  const dashOffset = indeterminate ? undefined : CIRCUMFERENCE * (1 - fraction);
  const dashArray = indeterminate ? "62 220" : undefined;

  const hasCenter = children !== undefined;

  return (
    <div
      aria-busy={indeterminate ? true : undefined}
      aria-label={ariaLabel}
      aria-valuemax={indeterminate ? undefined : max}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuetext={indeterminate ? undefined : `${percent}%`}
      className={cn(ringWrapVariants({ size }), className)}
      data-slot="ring-progress"
      role="progressbar"
      {...props}
    >
      <svg className={ringSvgVariants({ indeterminate })} viewBox="0 0 100 100">
        <circle className="fill-none stroke-secondary" cx="50" cy="50" r={RADIUS} strokeWidth={8} />
        <circle
          className={cn(
            "fill-none transition-[stroke-dashoffset,stroke] duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
            indicatorToneClass[resolvedTone],
          )}
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={dashArray ?? CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeWidth={8}
        />
      </svg>
      {hasCenter ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          {children}
        </div>
      ) : indeterminate ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
          <span className={ringValueVariants({ size, tone: resolvedTone })}>{percent}%</span>
          {label === undefined ? null : (
            <span className="text-[0.6875rem] font-medium text-muted-foreground">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}

export { RingProgress };

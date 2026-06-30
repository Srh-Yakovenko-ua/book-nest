"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

const stepperVariants = cva(
  "inline-flex items-stretch overflow-hidden rounded-md border border-input bg-field transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 data-[disabled=true]:bg-secondary data-[disabled=true]:opacity-55",
  {
    variants: {
      size: {
        sm: "h-10",
        md: "h-12",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const stepperButtonVariants = cva(
  "grid shrink-0 cursor-pointer place-items-center text-icon transition-colors outline-none hover:not-disabled:bg-secondary hover:not-disabled:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset active:not-disabled:bg-accent disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:size-[1.125rem]",
  {
    variants: {
      size: {
        sm: "w-[2.375rem]",
        md: "w-11",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const stepperInputVariants = cva(
  "min-w-0 [appearance:textfield] border-x border-input bg-transparent text-center font-semibold text-ink tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
  {
    variants: {
      size: {
        sm: "w-13 text-[0.9375rem]",
        md: "w-16 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type NumberStepperProps = VariantProps<typeof stepperVariants> & {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  max?: number;
  min?: number;
  onValueChange: (value: number) => void;
  step?: number;
  suffix?: React.ReactNode;
  value: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function NumberStepper({
  ariaLabel,
  className,
  disabled = false,
  max = Number.POSITIVE_INFINITY,
  min = Number.NEGATIVE_INFINITY,
  onValueChange,
  size,
  step = 1,
  suffix,
  value,
}: NumberStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  function commit(next: number) {
    onValueChange(clamp(next, min, max));
  }

  function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
    const parsed = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(parsed)) return;
    commit(parsed);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    blockNegativeNumberKeys(event);
    if (event.key === "ArrowUp") {
      event.preventDefault();
      commit(value + step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      commit(value - step);
    }
  }

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} data-slot="number-stepper">
      <div className={cn(stepperVariants({ size }))} data-disabled={disabled || undefined}>
        <button
          aria-label="Зменшити"
          className={cn(stepperButtonVariants({ size }))}
          disabled={disabled || atMin}
          onClick={() => commit(value - step)}
          type="button"
        >
          <UiIcon name="minus" />
        </button>
        <input
          aria-label={ariaLabel}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuenow={value}
          className={cn(stepperInputVariants({ size }))}
          disabled={disabled}
          inputMode="numeric"
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          role="spinbutton"
          type="text"
          value={value}
        />
        <button
          aria-label="Збільшити"
          className={cn(stepperButtonVariants({ size }))}
          disabled={disabled || atMax}
          onClick={() => commit(value + step)}
          type="button"
        >
          <UiIcon name="plus" />
        </button>
      </div>
      {suffix === undefined ? null : (
        <span className="text-[0.9375rem] text-muted-foreground">{suffix}</span>
      )}
    </div>
  );
}

export { NumberStepper, stepperVariants };

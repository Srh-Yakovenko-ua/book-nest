"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const DEFAULT_MAX = 10;

const ratingVariants = cva("relative inline-flex align-middle leading-none", {
  variants: {
    size: {
      sm: "[&_svg]:size-4",
      md: "[&_svg]:size-5",
      lg: "[&_svg]:size-6 sm:[&_svg]:size-[1.875rem]",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

type InteractiveRatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  disabled?: boolean;
  label?: string;
  max?: number;
  onValueChange: (value: number) => void;
  value: number;
};

type RatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  disabled?: boolean;
  label?: string;
  max?: number;
  onValueChange?: (value: number) => void;
  value: number;
};

type ReadOnlyRatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  label?: string;
  max?: number;
  value: number;
};

function clampToStep({ max, value }: { max: number; value: number }) {
  const stepped = Math.round(value * 2) / 2;
  return Math.min(max, Math.max(0, stepped));
}

function InteractiveRating({
  className,
  disabled,
  label,
  max = DEFAULT_MAX,
  onValueChange,
  size,
  value,
}: InteractiveRatingProps) {
  const [hovered, setHovered] = React.useState<null | number>(null);
  const ref = React.useRef<HTMLSpanElement>(null);
  const shown = hovered ?? value;

  function valueFromPointer(clientX: number) {
    const node = ref.current;
    if (!node) return value;
    const rect = node.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * max;
    return Math.max(0.5, clampToStep({ max, value: ratio }));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onValueChange(Math.min(max, value + 0.5));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onValueChange(Math.max(0, value - 0.5));
    } else if (event.key === "Home") {
      event.preventDefault();
      onValueChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onValueChange(max);
    }
  }

  return (
    <span
      aria-disabled={disabled || undefined}
      aria-label={label ?? "Оцінка"}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={`${value} з ${max}`}
      className={cn(
        ratingVariants({ size }),
        "rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
        className,
      )}
      data-slot="rating-input"
      onClick={(event) => onValueChange(valueFromPointer(event.clientX))}
      onKeyDown={handleKeyDown}
      onPointerLeave={() => setHovered(null)}
      onPointerMove={(event) => setHovered(valueFromPointer(event.clientX))}
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <StarRow count={max} filled={false} />
      <span
        className="pointer-events-none absolute top-0 left-0 overflow-hidden whitespace-nowrap motion-safe:transition-[width]"
        style={{ width: `${(shown / max) * 100}%` }}
      >
        <StarRow count={max} filled />
      </span>
    </span>
  );
}

function Rating({ onValueChange, ...props }: RatingProps) {
  if (onValueChange) {
    return <InteractiveRating onValueChange={onValueChange} {...props} />;
  }
  return <ReadOnlyRating {...props} />;
}

function ReadOnlyRating({ className, label, max = DEFAULT_MAX, size, value }: ReadOnlyRatingProps) {
  const clamped = Math.min(max, Math.max(0, value));

  return (
    <span
      aria-label={label ?? `Рейтинг ${clamped} з ${max}`}
      className={cn(ratingVariants({ size }), className)}
      data-slot="rating"
      role="img"
    >
      <StarRow count={max} filled={false} />
      <span
        className="absolute top-0 left-0 overflow-hidden whitespace-nowrap motion-safe:transition-[width]"
        style={{ width: `${(clamped / max) * 100}%` }}
      >
        <StarRow count={max} filled />
      </span>
    </span>
  );
}

function StarRow({ count, filled }: { count: number; filled: boolean }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: count }, (_, index) => (
        <UiIcon
          className={filled ? "text-warning" : "text-accent-border"}
          key={index}
          name={filled ? "star-fill" : "star"}
        />
      ))}
    </span>
  );
}

export { Rating, ratingVariants };

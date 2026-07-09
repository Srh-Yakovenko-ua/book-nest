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
  valueText?: (value: number, max: number) => string;
};

type RatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  disabled?: boolean;
  label?: string;
  max?: number;
  onValueChange?: (value: number) => void;
  value: number;
  valueText?: (value: number, max: number) => string;
};

type ReadOnlyRatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  label?: string;
  max?: number;
  value: number;
};

function InteractiveRating({
  className,
  disabled,
  label,
  max = DEFAULT_MAX,
  onValueChange,
  size,
  value,
  valueText,
}: InteractiveRatingProps) {
  const [hovered, setHovered] = React.useState<null | number>(null);
  const shown = hovered ?? value;
  const stepped = Math.round(shown * 2) / 2;

  function valueFromStar(
    index: number,
    event: React.MouseEvent<HTMLSpanElement> | React.PointerEvent<HTMLSpanElement>,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const isRightHalf = event.clientX - rect.left >= rect.width / 2;
    return index + (isRightHalf ? 1 : 0.5);
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
      aria-valuetext={valueText ? valueText(value, max) : `${value} з ${max}`}
      className={cn(
        ratingVariants({ size }),
        "rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        disabled ? "pointer-events-none opacity-50" : "cursor-pointer",
        className,
      )}
      data-slot="rating-input"
      onKeyDown={handleKeyDown}
      onPointerLeave={() => setHovered(null)}
      role="slider"
      tabIndex={disabled ? -1 : 0}
    >
      <span className="inline-flex gap-0.5">
        {Array.from({ length: max }, (_, index) => (
          <span
            aria-hidden
            className="cursor-pointer"
            key={index}
            onClick={(event) => onValueChange(valueFromStar(index, event))}
            onPointerMove={(event) => setHovered(valueFromStar(index, event))}
          >
            <Star fill={Math.max(0, Math.min(1, stepped - index))} />
          </span>
        ))}
      </span>
    </span>
  );
}

function Rating({ onValueChange, valueText, ...props }: RatingProps) {
  if (onValueChange) {
    return <InteractiveRating onValueChange={onValueChange} valueText={valueText} {...props} />;
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
      <StarRow count={max} value={clamped} />
    </span>
  );
}

function Star({ fill }: { fill: number }) {
  return (
    <span className="relative inline-flex">
      <UiIcon className="text-accent-border" name="star" />
      <span
        className="pointer-events-none absolute top-0 left-0 overflow-hidden whitespace-nowrap motion-safe:transition-[width]"
        style={{ width: `${fill * 100}%` }}
      >
        <UiIcon className="text-warning" name="star-fill" />
      </span>
    </span>
  );
}

function StarRow({ count, value }: { count: number; value: number }) {
  const stepped = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: count }, (_, index) => (
        <Star fill={Math.max(0, Math.min(1, stepped - index))} key={index} />
      ))}
    </span>
  );
}

export { Rating, ratingVariants };

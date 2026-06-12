"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const MAX = 5;

const ratingVariants = cva("relative inline-flex align-middle leading-none", {
  variants: {
    size: {
      sm: "[&_svg]:size-4",
      md: "[&_svg]:size-5",
      lg: "[&_svg]:size-[1.875rem]",
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
  onValueChange: (value: number) => void;
  value: number;
};

type RatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  disabled?: boolean;
  label?: string;
  onValueChange?: (value: number) => void;
  value: number;
};

type ReadOnlyRatingProps = VariantProps<typeof ratingVariants> & {
  className?: string;
  label?: string;
  value: number;
};

function clampToStep(value: number) {
  const stepped = Math.round(value * 2) / 2;
  return Math.min(MAX, Math.max(0, stepped));
}

function InteractiveRating({
  className,
  disabled,
  label,
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
    const ratio = ((clientX - rect.left) / rect.width) * MAX;
    return Math.max(0.5, clampToStep(ratio));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onValueChange(Math.min(MAX, value + 0.5));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onValueChange(Math.max(0, value - 0.5));
    } else if (event.key === "Home") {
      event.preventDefault();
      onValueChange(0);
    } else if (event.key === "End") {
      event.preventDefault();
      onValueChange(MAX);
    }
  }

  return (
    <span
      aria-disabled={disabled || undefined}
      aria-label={label ?? "Оцінка"}
      aria-valuemax={MAX}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={`${value} з ${MAX}`}
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
      <StarRow filled={false} />
      <span
        className="pointer-events-none absolute top-0 left-0 overflow-hidden whitespace-nowrap motion-safe:transition-[width]"
        style={{ width: `${(shown / MAX) * 100}%` }}
      >
        <StarRow filled />
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

function ReadOnlyRating({ className, label, size, value }: ReadOnlyRatingProps) {
  const clamped = Math.min(MAX, Math.max(0, value));

  return (
    <span
      aria-label={label ?? `Рейтинг ${clamped} з ${MAX}`}
      className={cn(ratingVariants({ size }), className)}
      data-slot="rating"
      role="img"
    >
      <StarRow filled={false} />
      <span
        className="absolute top-0 left-0 overflow-hidden whitespace-nowrap motion-safe:transition-[width]"
        style={{ width: `${(clamped / MAX) * 100}%` }}
      >
        <StarRow filled />
      </span>
    </span>
  );
}

function StarRow({ filled }: { filled: boolean }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: MAX }, (_, index) => (
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

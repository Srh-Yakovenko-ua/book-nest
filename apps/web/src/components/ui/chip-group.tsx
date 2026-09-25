"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const countSlotClassName = "min-w-[2ch] text-center tabular-nums";

const chipGroupVariants = cva("flex flex-wrap", {
  variants: {
    size: {
      sm: "gap-2",
      md: "gap-2.5",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const chipVariants = cva(
  "group/chip inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-tag font-medium whitespace-nowrap text-tag-foreground transition-[background-color,border-color,color,box-shadow] outline-none select-none hover:not-data-[state=on]:border-accent-border hover:not-data-[state=on]:bg-secondary focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground max-sm:min-h-11 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "px-3.5 py-1.5 text-[0.8125rem] [&_svg]:size-3.5",
        md: "px-4 py-2 text-sm [&_svg]:size-4",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type ChipGroupProps = (MultiChipGroupProps | SingleChipGroupProps) &
  VariantProps<typeof chipGroupVariants> & {
    className?: string;
    countsPending?: boolean;
    label?: string;
    options: readonly ChipOption[];
  };

type ChipOption = {
  count?: number;
  disabled?: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: string;
};

type MultiChipGroupProps = {
  mode: "multi";
  onValueChange: (value: string[]) => void;
  value: string[];
};

type SingleChipGroupProps = {
  mode: "single";
  onValueChange: (value: string) => void;
  value: string;
};

function ChipGroup({
  className,
  countsPending = false,
  label,
  options,
  size,
  ...rest
}: ChipGroupProps) {
  const items = options.map((option) => {
    const { count } = option;

    return (
      <ToggleGroupPrimitive.Item
        className={cn(chipVariants({ size }))}
        data-slot="chip"
        disabled={option.disabled}
        key={option.value}
        value={option.value}
      >
        {option.icon}
        {option.label}
        {typeof count === "number" ? (
          <span
            className={cn(
              countSlotClassName,
              "text-muted-foreground group-data-[state=on]/chip:text-primary-foreground",
            )}
          >
            {count}
          </span>
        ) : (
          countsPending && (
            <Skeleton
              aria-hidden
              className={cn(
                countSlotClassName,
                "h-3 rounded-sm group-data-[state=on]/chip:bg-primary-foreground/40",
              )}
              data-slot="chip-count-pending"
            />
          )
        )}
      </ToggleGroupPrimitive.Item>
    );
  });

  if (rest.mode === "single") {
    return (
      <ToggleGroupPrimitive.Root
        aria-label={label}
        className={cn(chipGroupVariants({ size }), className)}
        data-slot="chip-group"
        onValueChange={(next) => {
          if (next) rest.onValueChange(next);
        }}
        type="single"
        value={rest.value}
      >
        {items}
      </ToggleGroupPrimitive.Root>
    );
  }

  return (
    <ToggleGroupPrimitive.Root
      aria-label={label}
      className={cn(chipGroupVariants({ size }), className)}
      data-slot="chip-group"
      onValueChange={rest.onValueChange}
      type="multiple"
      value={rest.value}
    >
      {items}
    </ToggleGroupPrimitive.Root>
  );
}

export { ChipGroup, chipGroupVariants, chipVariants };

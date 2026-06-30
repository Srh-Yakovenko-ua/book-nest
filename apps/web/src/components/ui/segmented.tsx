"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

const segmentedVariants = cva(
  "inline-flex w-fit items-center rounded-full border border-border bg-field p-1 data-[block=true]:flex data-[block=true]:w-full",
  {
    variants: {
      tone: {
        surface: "",
        accent: "",
      },
    },
    defaultVariants: {
      tone: "surface",
    },
  },
);

const segmentedItemVariants = cva(
  "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors outline-none select-none hover:not-data-[state=on]:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        surface: "data-[state=on]:bg-card data-[state=on]:text-ink data-[state=on]:shadow-soft",
        accent: "data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
      },
    },
    defaultVariants: {
      tone: "surface",
    },
  },
);

type SegmentedOption = {
  disabled?: boolean;
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: string;
};

type SegmentedProps = VariantProps<typeof segmentedVariants> & {
  block?: boolean;
  className?: string;
  disabled?: boolean;
  label?: string;
  onValueChange: (value: string) => void;
  options: readonly SegmentedOption[];
  value: string;
};

function Segmented({
  block,
  className,
  disabled,
  label,
  onValueChange,
  options,
  tone,
  value,
}: SegmentedProps) {
  return (
    <ToggleGroupPrimitive.Root
      aria-label={label}
      className={cn(segmentedVariants({ tone }), className)}
      data-block={block || undefined}
      data-slot="segmented"
      disabled={disabled}
      onValueChange={(next) => {
        if (next) onValueChange(next);
      }}
      type="single"
      value={value}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          className={cn(segmentedItemVariants({ tone }))}
          data-slot="segmented-item"
          disabled={option.disabled}
          key={option.value}
          value={option.value}
        >
          {option.icon}
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}

export { Segmented, segmentedItemVariants, segmentedVariants };

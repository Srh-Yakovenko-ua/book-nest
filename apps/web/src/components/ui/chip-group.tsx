"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

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
  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-tag font-medium text-tag-foreground transition-[background-color,border-color,color,box-shadow] outline-none select-none hover:not-data-[state=on]:border-accent-border hover:not-data-[state=on]:bg-secondary focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45 data-[state=on]:border-chip data-[state=on]:bg-chip data-[state=on]:text-chip-foreground [&_svg]:shrink-0",
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
    label?: string;
    options: readonly ChipOption[];
  };

type ChipOption = {
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

function ChipGroup({ className, label, options, size, ...rest }: ChipGroupProps) {
  const items = options.map((option) => (
    <ToggleGroupPrimitive.Item
      className={cn(chipVariants({ size }))}
      data-slot="chip"
      disabled={option.disabled}
      key={option.value}
      value={option.value}
    >
      {option.icon}
      {option.label}
    </ToggleGroupPrimitive.Item>
  ));

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

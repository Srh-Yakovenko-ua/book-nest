"use client";

import { type KeyboardEvent, useId } from "react";

import { chipVariants } from "@/components/ui/chip-group";
import { cn } from "@/lib/utils";

type MultiStatusChipGroupProps = {
  label: string;
  mode: "multi";
  onValueChange: (value: string[]) => void;
  options: readonly StatusOption[];
  value: readonly string[];
};

type SingleStatusChipGroupProps = {
  label: string;
  mode?: "single";
  onValueChange: (value: string) => void;
  options: readonly StatusOption[];
  value: string;
};

type StatusOption = {
  label: string;
  value: string;
};

const NEXT_KEYS = new Set(["ArrowDown", "ArrowRight"]);
const PREV_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

export function StatusChipGroup(props: MultiStatusChipGroupProps | SingleStatusChipGroupProps) {
  if (props.mode === "multi") return <MultiStatusChipGroup {...props} />;
  return <SingleStatusChipGroup {...props} />;
}

function MultiStatusChipGroup({ label, onValueChange, options, value }: MultiStatusChipGroupProps) {
  function toggle(option: string) {
    const next = value.includes(option)
      ? value.filter((item) => item !== option)
      : [...value, option];
    onValueChange(next);
  }

  return (
    <div aria-label={label} className="flex flex-wrap gap-2.5" role="group">
      {options.map((option) => {
        const pressed = value.includes(option.value);
        return (
          <button
            aria-pressed={pressed}
            className={cn(chipVariants(), "cursor-pointer")}
            data-state={pressed ? "on" : "off"}
            key={option.value}
            onClick={() => toggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SingleStatusChipGroup({
  label,
  onValueChange,
  options,
  value,
}: SingleStatusChipGroupProps) {
  const groupId = useId();

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!NEXT_KEYS.has(event.key) && !PREV_KEYS.has(event.key)) return;
    event.preventDefault();
    const delta = NEXT_KEYS.has(event.key) ? 1 : -1;
    const next = options[(index + delta + options.length) % options.length];
    if (next === undefined) return;
    onValueChange(next.value);
    const node = document.getElementById(`${groupId}-${next.value}`);
    if (node instanceof HTMLElement) node.focus();
  }

  return (
    <div aria-label={label} className="flex flex-wrap gap-2.5" role="radiogroup">
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            aria-checked={checked}
            className={cn(chipVariants(), "cursor-pointer")}
            data-state={checked ? "on" : "off"}
            id={`${groupId}-${option.value}`}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            role="radio"
            tabIndex={checked || (value === "" && index === 0) ? 0 : -1}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

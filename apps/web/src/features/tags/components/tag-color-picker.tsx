"use client";

import type { TagColor } from "@app/shared";
import type { KeyboardEvent } from "react";

import { TAG_COLORS } from "@app/shared";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { tagColorStyle } from "../model/tag-color";

type TagColorPickerProps = {
  labelledBy: string;
  onChange: (color: TagColor) => void;
  value: TagColor;
};

const COLOR_STEP_BY_KEY: Partial<Record<string, number>> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

export function TagColorPicker({ labelledBy, onChange, value }: TagColorPickerProps) {
  const t = useTranslations("tags.colors");

  function colorForKey(key: string): TagColor | undefined {
    if (key === "Home") return TAG_COLORS[0];
    if (key === "End") return TAG_COLORS.at(-1);
    const step = COLOR_STEP_BY_KEY[key];
    if (step === undefined) return undefined;
    const count = TAG_COLORS.length;
    return TAG_COLORS[(TAG_COLORS.indexOf(value) + step + count) % count];
  }

  function moveSelection(event: KeyboardEvent<HTMLButtonElement>) {
    const next = colorForKey(event.key);
    if (next === undefined) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)
      ?.focus();
  }

  return (
    <div aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2" role="radiogroup">
      {TAG_COLORS.map((color) => {
        const selected = color === value;
        return (
          <button
            aria-checked={selected}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-[box-shadow,border-color] outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected ? "border-ring ring-[3px] ring-ring/30" : "hover:border-accent-border",
            )}
            data-color={color}
            key={color}
            onClick={() => onChange(color)}
            onKeyDown={moveSelection}
            role="radio"
            style={tagColorStyle(color)}
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span
              className="grid size-4 shrink-0 place-items-center rounded-full border"
              style={{ borderColor: "currentColor" }}
            >
              {selected ? <UiIcon name="check" size={12} /> : null}
            </span>
            <span className="leading-snug">{t(color)}</span>
          </button>
        );
      })}
    </div>
  );
}

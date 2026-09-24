"use client";

import type { TagColor } from "@app/shared";
import type { KeyboardEvent } from "react";

import { TAG_COLORS } from "@app/shared";
import { useTranslations } from "next-intl";

import { TAG_COLOR_SWATCH, TagColorSelection, TagColorSwatchButton } from "./tag-color-swatch";

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
    event.currentTarget
      .closest("[role=radiogroup]")
      ?.querySelector<HTMLButtonElement>(`[data-color="${next}"]`)
      ?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div aria-labelledby={labelledBy} className={TAG_COLOR_SWATCH.grid} role="radiogroup">
        {TAG_COLORS.map((color) => {
          const selected = color === value;
          return (
            <TagColorSwatchButton
              aria-checked={selected}
              aria-label={t(color)}
              color={color}
              isSelected={selected}
              key={color}
              onClick={() => onChange(color)}
              onKeyDown={moveSelection}
              role="radio"
              tabIndex={selected ? 0 : -1}
              tooltip={t(color)}
            />
          );
        })}
      </div>
      <TagColorSelection colors={[value]} />
    </div>
  );
}

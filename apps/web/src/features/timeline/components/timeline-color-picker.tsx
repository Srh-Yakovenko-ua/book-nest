"use client";

import type { TimelineColorKey } from "@app/shared";
import type { KeyboardEvent } from "react";

import { TIMELINE_COLOR_KEYS } from "@app/shared";
import { useTranslations } from "next-intl";

import { PALETTE_SWATCH, PaletteSwatchButton } from "@/components/palette-swatch";

import { TimelineLineChip } from "./timeline-line-chip";

const COLOR_STEP_BY_KEY: Partial<Record<string, number>> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

type TimelineColorPickerProps = {
  labelledBy: string;
  name: string;
  onChange: (colorKey: TimelineColorKey) => void;
  value: TimelineColorKey;
};

export function TimelineColorPicker({
  labelledBy,
  name,
  onChange,
  value,
}: TimelineColorPickerProps) {
  const t = useTranslations("timeline.manage");
  const tColor = useTranslations("timeline.colorKey");

  function colorForKey(key: string): TimelineColorKey | undefined {
    if (key === "Home") return TIMELINE_COLOR_KEYS[0];
    if (key === "End") return TIMELINE_COLOR_KEYS.at(-1);
    const step = COLOR_STEP_BY_KEY[key];
    if (step === undefined) return undefined;
    const count = TIMELINE_COLOR_KEYS.length;
    return TIMELINE_COLOR_KEYS[(TIMELINE_COLOR_KEYS.indexOf(value) + step + count) % count];
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

  const trimmedName = name.trim();
  const previewName = trimmedName.length > 0 ? trimmedName : t("namePlaceholder");

  return (
    <div className="flex flex-col gap-3">
      <div aria-labelledby={labelledBy} className={PALETTE_SWATCH.grid} role="radiogroup">
        {TIMELINE_COLOR_KEYS.map((colorKey) => {
          const selected = colorKey === value;

          return (
            <PaletteSwatchButton
              aria-checked={selected}
              aria-label={tColor(colorKey)}
              color={colorKey}
              isSelected={selected}
              key={colorKey}
              onClick={() => onChange(colorKey)}
              onKeyDown={moveSelection}
              role="radio"
              tabIndex={selected ? 0 : -1}
              tooltip={tColor(colorKey)}
            />
          );
        })}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t("previewLabel")}</p>
        <TimelineLineChip
          className="max-w-full cursor-default"
          colorKey={value}
          name={previewName}
        />
      </div>
    </div>
  );
}

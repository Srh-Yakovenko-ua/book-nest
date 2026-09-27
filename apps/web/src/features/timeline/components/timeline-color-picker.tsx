"use client";

import type { TimelineColorKey } from "@app/shared";
import type { KeyboardEvent } from "react";

import { TIMELINE_COLOR_KEYS } from "@app/shared";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";
import { cn } from "@/lib/utils";

import { markerStyle } from "../model/color-key";

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
    <div className="flex flex-col gap-2">
      <div
        aria-labelledby={labelledBy}
        className="grid grid-cols-4 justify-items-start gap-2"
        role="radiogroup"
      >
        {TIMELINE_COLOR_KEYS.map((colorKey) => {
          const selected = colorKey === value;
          const style = PALETTE_COLOR_STYLES[colorKey];

          return (
            <button
              aria-checked={selected}
              aria-label={tColor(colorKey)}
              className={cn(
                "grid size-10 cursor-pointer place-items-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "outline-[1.5px] outline-offset-2 outline-current outline-solid",
              )}
              data-color={colorKey}
              key={colorKey}
              onClick={() => onChange(colorKey)}
              onKeyDown={moveSelection}
              role="radio"
              style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {selected ? <UiIcon name="check" size={16} /> : null}
            </button>
          );
        })}
      </div>
      <p className="flex min-w-0 items-center gap-2 text-sm text-foreground">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={markerStyle(value)} />
        <span className="truncate">{previewName}</span>
      </p>
    </div>
  );
}

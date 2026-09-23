"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { TagColor } from "../model/tag-color";

import { TAG_COLORS, tagColorStyle } from "../model/tag-color";

type TagColorPickerProps = {
  id: string;
  onChange: (color: TagColor) => void;
  value: TagColor;
};

export function TagColorPicker({ id, onChange, value }: TagColorPickerProps) {
  const t = useTranslations("genresTags.colors");
  const tField = useTranslations("genresTags.tagDialog");

  return (
    <div aria-label={tField("color")} className="grid grid-cols-2 gap-2" id={id} role="radiogroup">
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
            key={color}
            onClick={() => onChange(color)}
            role="radio"
            style={tagColorStyle(color)}
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

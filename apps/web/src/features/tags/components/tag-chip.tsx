import type { TagColor } from "@app/shared";
import type { ComponentPropsWithoutRef, Ref } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { TAG_COLOR_STYLES } from "../model/tag-color";

type TagChipProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "color"> & {
  as?: "h3" | "li" | "span";
  color: TagColor;
  name: string;
  nameClassName?: string;
  nameRef?: Ref<HTMLSpanElement>;
};

export function TagChip({
  as: Element = "span",
  className,
  color,
  name,
  nameClassName,
  nameRef,
  style,
  ...props
}: TagChipProps) {
  const colors = TAG_COLOR_STYLES[color];

  return (
    <Element
      className={cn(
        "inline-flex w-fit max-w-full min-w-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
        className,
      )}
      style={{ ...style, backgroundColor: colors.bg, color: colors.text }}
      {...props}
    >
      <UiIcon aria-hidden className="shrink-0 opacity-70" name="hash" size={12} />
      <span className={cn("min-w-0 truncate", nameClassName)} ref={nameRef}>
        {name}
      </span>
    </Element>
  );
}

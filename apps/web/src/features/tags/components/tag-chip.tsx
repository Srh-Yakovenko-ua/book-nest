import type { TagColor } from "@app/shared";
import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { TAG_COLOR_STYLES } from "../model/tag-color";

type TagChipProps = Omit<ComponentPropsWithoutRef<"span">, "children" | "color"> & {
  as?: "h3" | "li" | "span";
  color: TagColor;
  name: string;
  nameClassName?: string;
  nameRef?: Ref<HTMLSpanElement>;
  trailing?: ReactNode;
};

export function TagChip({
  as: Element = "span",
  className,
  color,
  name,
  nameClassName,
  nameRef,
  style,
  trailing,
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
      {trailing}
    </Element>
  );
}

export function TagChipRemoveButton({
  className,
  label,
  onClick,
}: {
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "relative grid size-[18px] shrink-0 cursor-pointer place-items-center rounded-full text-current opacity-65 transition-[opacity,background-color] after:absolute after:-inset-[3px] hover:bg-current/15 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      <UiIcon aria-hidden className="size-3" name="x" size={12} />
    </button>
  );
}

"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { ListBookSelection } from "../model/list-book-item";
import type { ListBookReorder } from "../model/list-reorder";
import type { ListBookDrag } from "../model/use-list-book-drag";

type ListBookDragHandleProps = {
  children?: ReactNode;
  className?: string;
  drag?: ListBookDrag;
  label?: string;
  onMove: (direction: "down" | "up") => void;
  reorder: ListBookReorder;
  title: string;
};

const DRAG_HANDLE_SQUARE =
  "size-8 rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur-md hover:text-brand";

export function ListBookDragHandle({
  children,
  className,
  drag,
  label,
  onMove,
  reorder,
  title,
}: ListBookDragHandleProps) {
  const t = useTranslations("lists.details.reorder");

  if (reorder.kind === "locked") return null;

  return (
    <TooltipHint label={t("handleHint")}>
      <button
        aria-label={label ?? t("handle", { title })}
        className={cn(
          "inline-flex cursor-grab items-center justify-center gap-1.5 transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
          className ?? DRAG_HANDLE_SQUARE,
        )}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" && reorder.canMoveUp) {
            event.preventDefault();
            onMove("up");
          }
          if (event.key === "ArrowDown" && reorder.canMoveDown) {
            event.preventDefault();
            onMove("down");
          }
        }}
        type="button"
        {...drag?.handleProps}
      >
        <UiIcon name="grip" size={16} />
        {children}
      </button>
    </TooltipHint>
  );
}

export function ListBookFavoriteButton({
  isFavorite,
  onToggle,
}: {
  isFavorite: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("lists.details.book");
  const label = isFavorite ? t("unfavorite") : t("favorite");

  return (
    <TooltipHint label={label}>
      <Button
        aria-label={label}
        aria-pressed={isFavorite}
        className={cn(
          "size-8 rounded-lg border backdrop-blur-md transition-all duration-[180ms] ease-out",
          isFavorite
            ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover"
            : "border-[color:var(--book-overlay-pill-border)] bg-[var(--book-overlay-pill-surface)] text-[color:var(--book-overlay-pill-foreground)] shadow-[var(--book-overlay-pill-shadow)] hover:border-brand hover:text-brand",
        )}
        onClick={onToggle}
        size="icon-sm"
        variant="ghost"
      >
        <UiIcon name={isFavorite ? "heart-fill" : "heart"} size={18} />
      </Button>
    </TooltipHint>
  );
}

export function ListBookSelectionCheckbox({
  selection,
  title,
}: {
  selection: ListBookSelection;
  title: string;
}) {
  const t = useTranslations("lists.details.selection");

  return (
    <span className="grid size-9 cursor-pointer place-items-center rounded-2xl border border-[color:var(--book-overlay-pill-border)] bg-[var(--book-overlay-pill-surface)] shadow-[var(--book-overlay-pill-shadow)] backdrop-blur-md">
      <Checkbox
        aria-label={t("selectBook", { title })}
        checked={selection.isSelected}
        onCheckedChange={selection.onToggle}
      />
    </span>
  );
}

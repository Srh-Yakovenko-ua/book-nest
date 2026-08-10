"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import type { ListBookSelection } from "../model/list-book-item";
import type { ListBookReorder } from "../model/list-reorder";
import type { ListBookDrag } from "../model/use-list-book-drag";

type ListBookDragHandleProps = {
  drag?: ListBookDrag;
  onMove: (direction: "down" | "up") => void;
  reorder: ListBookReorder;
  title: string;
};

export function ListBookDragHandle({ drag, onMove, reorder, title }: ListBookDragHandleProps) {
  const t = useTranslations("lists.details.reorder");

  if (reorder.kind === "locked") return null;

  return (
    <button
      aria-label={t("handle", { title })}
      className="grid size-8 cursor-grab place-items-center rounded-lg border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur-md transition-colors duration-150 hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
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
      title={t("handleHint")}
      type="button"
      {...drag?.handleProps}
    >
      <UiIcon name="grip" size={16} />
    </button>
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
      title={label}
      variant="ghost"
    >
      <UiIcon name={isFavorite ? "heart-fill" : "heart"} size={18} />
    </Button>
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

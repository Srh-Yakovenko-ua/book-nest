"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ListBulkBarProps = {
  isPending: boolean;
  loadedCount: number;
  onAddFavorite: () => void;
  onAddToList: () => void;
  onAddToQueue: () => void;
  onClear: () => void;
  onRemoveFavorite: () => void;
  onRemoveFromList: () => void;
  onSelectAll: () => void;
  selectedCount: number;
};

export function ListBulkBar({
  isPending,
  loadedCount,
  onAddFavorite,
  onAddToList,
  onAddToQueue,
  onClear,
  onRemoveFavorite,
  onRemoveFromList,
  onSelectAll,
  selectedCount,
}: ListBulkBarProps) {
  const t = useTranslations("lists.details.selection");

  return (
    <div className="sticky inset-x-0 bottom-3 z-30 safe-bottom motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-3 sm:pb-0">
      <div
        aria-label={t("regionLabel")}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-pop backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        role="region"
      >
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm font-medium text-ink">
            {t("selected", { loaded: loadedCount, selected: selectedCount })}
          </span>
          <Button
            className="text-muted-foreground hover:text-foreground sm:hidden"
            onClick={onClear}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="x" size={16} />
            <span className="sr-only">{t("clear")}</span>
          </Button>
        </div>

        <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1">
          <Button
            disabled={selectedCount === loadedCount}
            onClick={onSelectAll}
            size="sm"
            variant="ghost"
          >
            <UiIcon name="check-check" size={16} />
            {t("selectAll")}
          </Button>

          <Button disabled={isPending} onClick={onAddToList} size="sm" variant="secondary">
            <UiIcon name="list" size={16} />
            {t("addToList")}
          </Button>

          <Button disabled={isPending} onClick={onAddToQueue} size="sm" variant="secondary">
            <UiIcon name="bookmark" size={16} />
            {t("addToQueue")}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={isPending} size="sm" variant="secondary">
                <UiIcon name="heart" size={16} />
                {t("favoriteMenu")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onAddFavorite}>
                <UiIcon name="heart-fill" size={16} />
                {t("favorite")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onRemoveFavorite}>
                <UiIcon name="heart" size={16} />
                {t("unfavorite")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            disabled={isPending}
            loading={isPending}
            onClick={onRemoveFromList}
            size="sm"
            variant="destructive"
          >
            <UiIcon name="x-circle" size={16} />
            {t("remove")}
          </Button>

          <Button
            className="hidden text-muted-foreground hover:text-foreground sm:inline-flex"
            onClick={onClear}
            size="sm"
            variant="ghost"
          >
            {t("clear")}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type LibraryBulkBarProps = {
  count: number;
  onAddFavorite: () => void;
  onAddTags: () => void;
  onAddToList: () => void;
  onAddToQueue: () => void;
  onChangeOwnership: () => void;
  onChangeReadingStatus: () => void;
  onClear: () => void;
  onDelete: () => void;
  onRemoveFavorite: () => void;
};

export function LibraryBulkBar({
  count,
  onAddFavorite,
  onAddTags,
  onAddToList,
  onAddToQueue,
  onChangeOwnership,
  onChangeReadingStatus,
  onClear,
  onDelete,
  onRemoveFavorite,
}: LibraryBulkBarProps) {
  const t = useTranslations("books.library.bulk");

  return (
    <div className="sticky inset-x-0 bottom-3 z-30 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-3">
      <div
        aria-label={t("regionLabel")}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-pop backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 sm:flex-row sm:items-center sm:justify-between"
        role="region"
      >
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm font-medium text-ink">{t("selected", { count })}</span>
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

        <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1 sm:flex-nowrap">
          <Button onClick={onAddToList} size="sm" variant="secondary">
            <UiIcon name="list" size={16} />
            {t("addToList")}
          </Button>
          <Button onClick={onAddToQueue} size="sm" variant="secondary">
            <UiIcon name="bookmark" size={16} />
            {t("addToQueue")}
          </Button>
          <Button onClick={onChangeReadingStatus} size="sm" variant="secondary">
            <UiIcon name="swap" size={16} />
            {t("changeReadingStatus")}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <UiIcon name="more" size={16} />
                {t("more")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onChangeOwnership}>
                <UiIcon name="package" size={16} />
                {t("changeOwnership")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onAddTags}>
                <UiIcon name="tag" size={16} />
                {t("addTags")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onAddFavorite}>
                <UiIcon name="heart-fill" size={16} />
                {t("addFavorite")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onRemoveFavorite}>
                <UiIcon name="heart" size={16} />
                {t("removeFavorite")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={onDelete} size="sm" variant="destructive">
            <UiIcon name="trash" size={16} />
            {t("delete")}
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

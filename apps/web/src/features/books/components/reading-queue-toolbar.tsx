"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReadingQueueToolbarProps = {
  hasSearch: boolean;
  onClearSearch: () => void;
  onSearchChange: (value: string) => void;
  search: string;
};

export function ReadingQueueToolbar({
  hasSearch,
  onClearSearch,
  onSearchChange,
  search,
}: ReadingQueueToolbarProps) {
  const t = useTranslations("readingQueue.toolbar");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex flex-1 items-center">
          <UiIcon
            aria-hidden
            className="pointer-events-none absolute left-3 text-muted-foreground"
            name="search"
            size={18}
          />
          <input
            aria-label={t("searchLabel")}
            autoComplete="off"
            className="h-10 w-full rounded-md border border-input bg-field pr-10 pl-10 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            enterKeyHint="search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            type="text"
            value={search}
          />
          {search.length > 0 ? (
            <button
              aria-label={t("clearSearch")}
              className="absolute right-2 grid size-6 cursor-pointer place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={onClearSearch}
              type="button"
            >
              <UiIcon name="x" size={16} />
            </button>
          ) : null}
        </div>

        <Select value="position">
          <SelectTrigger aria-label={t("sortLabel")} className="h-10 w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="position">{t("sortOptions.position")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {hasSearch ? t("dragDisabledHint") : t("dragHint")}
      </p>
    </div>
  );
}

"use client";

import type { SeriesDetailsView } from "@app/shared";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { seriesStatuses } from "@/lib/book-status";

type SeriesDetailsHeroProps = {
  details: SeriesDetailsView;
  onAddBook: () => void;
  onDelete: () => void;
  onEdit: () => void;
};

export function SeriesDetailsHero({
  details,
  onAddBook,
  onDelete,
  onEdit,
}: SeriesDetailsHeroProps) {
  const t = useTranslations("series.details");
  const tStatus = useTranslations("series.status");

  const statusBase =
    seriesStatuses.find((entry) => entry.value === details.status) ?? seriesStatuses[2];
  const authorsLine =
    details.authors.length > 0
      ? details.authors.map((author) => author.name).join(", ")
      : t("authorsUnknown");
  const description = details.description?.trim() ?? "";

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:flex-row sm:gap-7 md:p-7">
      <SeriesCover alt={t("coverAlt", { name: details.name })} name={details.name} />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="font-heading text-2xl leading-tight font-semibold text-ink md:text-3xl">
              {details.name}
            </h1>
            <p className="text-base font-medium text-foreground/90">{authorsLine}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusBadge entry={{ ...statusBase, label: tStatus(details.status) }} />
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <UiIcon className="text-icon" name="book" size={15} />
                {details.totalBooks === null
                  ? t("books", { count: details.booksInSeries })
                  : t("booksWithTotal", {
                      count: details.booksInSeries,
                      total: details.totalBooks,
                    })}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={onEdit} size="sm" variant="outline">
              <UiIcon name="edit" size={16} />
              {t("edit")}
            </Button>
            <Button onClick={onAddBook} size="sm">
              <UiIcon name="plus" size={16} />
              {t("addBook")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label={t("menu")} size="icon" variant="outline">
                  <UiIcon name="more" size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onEdit}>
                  <UiIcon name="edit" size={16} />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onAddBook}>
                  <UiIcon name="plus" size={16} />
                  {t("addBook")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onDelete} variant="destructive">
                  <UiIcon name="trash" size={16} />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {description.length === 0 ? null : (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </section>
  );
}

function SeriesCover({ alt, name }: { alt: string; name: string }) {
  return (
    <div
      aria-label={alt}
      className="relative mx-auto grid aspect-[3/4] w-32 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-accent-foreground shadow-card sm:mx-0 sm:w-36"
      role="img"
    >
      <UiIcon
        className="absolute top-2.5 right-2.5 text-accent-foreground/40"
        name="layers"
        size={18}
      />
      <span className="font-heading text-4xl font-bold text-accent-foreground/85">
        {seriesInitials(name)}
      </span>
    </div>
  );
}

function seriesInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const letters = words.slice(0, 2).map((word) => word[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

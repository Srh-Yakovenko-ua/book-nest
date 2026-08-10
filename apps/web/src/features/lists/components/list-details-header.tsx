"use client";

import type { MediaView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import { ListCardCovers } from "./list-card-covers";

type ListDetailsHeaderProps = {
  bookCount: number;
  description: null | string;
  isDuplicating: boolean;
  name: string;
  onAddBooks: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
  previewCovers: MediaView[];
  updatedAt: string;
};

export function ListDetailsHeader({
  bookCount,
  description,
  isDuplicating,
  name,
  onAddBooks,
  onDelete,
  onDuplicate,
  onEdit,
  previewCovers,
  updatedAt,
}: ListDetailsHeaderProps) {
  const t = useTranslations("lists.details");
  const tHeader = useTranslations("lists.details.header");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-4">
      <Link
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        href="/lists"
      >
        <UiIcon name="arrow-left" size={16} />
        {t("back")}
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        {bookCount === 0 ? null : (
          <div className="w-40 shrink-0">
            <ListCardCovers
              bookCount={bookCount}
              coverAlt={tHeader("coverAlt", { name })}
              covers={previewCovers}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="font-heading text-2xl font-semibold text-ink">{name}</h1>
              {description === null ? null : (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={onAddBooks}>
                <UiIcon name="plus" size={16} />
                {tHeader("addBooks")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label={tHeader("manage")} size="icon" variant="outline">
                    <UiIcon name="more" size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={onEdit}>
                    <UiIcon name="edit" size={16} />
                    {tHeader("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={isDuplicating} onSelect={onDuplicate}>
                    <UiIcon name="copy" size={16} />
                    {tHeader("duplicate")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onDelete} variant="destructive">
                    <UiIcon name="trash" size={16} />
                    {tHeader("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <UiIcon className="shrink-0 text-icon" name="clock" size={15} />
            {tHeader("updated", { date: formatDate(updatedAt, locale) })}
          </p>
        </div>
      </header>
    </div>
  );
}

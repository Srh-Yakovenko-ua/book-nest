"use client";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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

type ListDetailsHeaderProps = {
  bookCount: number;
  createdAt: string;
  description: null | string;
  name: string;
  onAddBooks: () => void;
  onDelete: () => void;
  onEdit: () => void;
  updatedAt: string;
};

export function ListDetailsHeader({
  bookCount,
  createdAt,
  description,
  name,
  onAddBooks,
  onDelete,
  onEdit,
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

      <header className="flex flex-col gap-3">
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onEdit}>
                  <UiIcon name="edit" size={16} />
                  {tHeader("edit")}
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

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sm text-muted-foreground">
          <Badge className="tabular-nums" variant="secondary">
            {t("books", { count: bookCount })}
          </Badge>
          <span className="inline-flex items-center gap-1.5">
            <UiIcon className="shrink-0 text-icon" name="calendar" size={15} />
            {tHeader("created", { date: formatDate(createdAt, locale) })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <UiIcon className="shrink-0 text-icon" name="clock" size={15} />
            {tHeader("updated", { date: formatDate(updatedAt, locale) })}
          </span>
        </div>
      </header>
    </div>
  );
}

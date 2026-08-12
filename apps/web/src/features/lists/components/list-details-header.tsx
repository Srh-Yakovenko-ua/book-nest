"use client";

import type { MediaView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";

const HERO_COVERS_LIMIT = 4;

type ListDetailsHeaderProps = {
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
  const tHeader = useTranslations("lists.details.header");
  const locale = useLocale();
  const covers = previewCovers.slice(0, HERO_COVERS_LIMIT);

  return (
    <header className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-detail-block sm:flex-row sm:items-start sm:gap-5 md:p-7">
      {covers.length === 0 ? null : (
        <div className="grid w-24 shrink-0 grid-cols-2 gap-1.5 lg:w-48 lg:gap-2">
          {covers.map((cover) => (
            <span
              className="relative aspect-square overflow-hidden rounded-md bg-accent shadow-soft lg:rounded-lg"
              key={cover.id}
            >
              <Image
                alt={tHeader("coverAlt", { name })}
                className="object-cover object-top"
                fill
                sizes="(min-width: 1024px) 96px, 48px"
                src={cover.urls.thumb}
                unoptimized
              />
            </span>
          ))}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-semibold text-ink">{name}</h1>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <UiIcon className="shrink-0 text-icon" name="clock" size={15} />
              {tHeader("updated", { date: formatDate(updatedAt, locale) })}
            </p>
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

        {description === null ? null : (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    </header>
  );
}

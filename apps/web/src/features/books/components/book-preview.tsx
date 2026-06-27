"use client";

import type { BookFormat, OwnershipStatus, ReadingStatus } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { type ReactNode, useState } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Rating } from "@/components/ui/rating";
import { StatusBadge } from "@/components/ui/status-badge";
import { ownershipStatuses, readingStatuses, type StatusEntry } from "@/lib/book-status";
import { cn } from "@/lib/utils";

type BookPreviewProps = {
  authorName: string;
  coverSrc?: string;
  description: string;
  formats?: readonly BookFormat[];
  genres?: readonly string[];
  inQueue?: boolean;
  isFavorite?: boolean;
  ownershipStatus?: OwnershipStatus;
  publisherName: string;
  rating?: number;
  readingStatus?: ReadingStatus;
  tags?: readonly string[];
  title: string;
};

const GENRES_VISIBLE = 4;
const TAGS_VISIBLE = 4;

const FORMAT_ICONS: Record<BookFormat, UiIconName> = {
  audiobook: "headphones",
  ebook: "tablet",
  paper: "book",
};

export function BookPreview({
  authorName,
  coverSrc,
  description,
  formats = [],
  genres = [],
  inQueue = false,
  isFavorite = false,
  ownershipStatus,
  publisherName,
  rating,
  readingStatus,
  tags = [],
  title,
}: BookPreviewProps) {
  const t = useTranslations("books");
  const [coverLoaded, setCoverLoaded] = useState(false);
  const hasTitle = title.trim().length > 0;
  const hasAuthor = authorName.trim().length > 0;
  const hasPublisher = publisherName.trim().length > 0;

  const readingEntry = entryFor(readingStatuses, readingStatus, "not_started");
  const ownershipEntry = entryFor(ownershipStatuses, ownershipStatus, "none");

  const visibleGenres = genres.slice(0, GENRES_VISIBLE);
  const genresOverflow = genres.length - visibleGenres.length;
  const visibleTags = tags.slice(0, TAGS_VISIBLE);
  const tagsOverflow = tags.length - visibleTags.length;

  const showRating = readingStatus === "finished" && typeof rating === "number" && rating > 0;

  const coverInitial = hasTitle ? title.trim().charAt(0).toUpperCase() : null;

  return (
    <aside
      aria-label={t("preview.eyebrow")}
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card md:p-6"
    >
      <div className="flex items-center gap-2.5">
        <UiIcon className="text-primary" name="sparkles" size={20} />
        <h2 className="font-heading text-lg text-ink">{t("preview.eyebrow")}</h2>
      </div>

      <div className="flex gap-4">
        <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft">
          {coverSrc === undefined ? (
            <div className="grid h-full w-full place-items-center text-accent-foreground">
              {coverInitial === null ? (
                <UiIcon name="book" size={28} />
              ) : (
                <span className="font-heading text-3xl leading-none font-semibold">
                  {coverInitial}
                </span>
              )}
            </div>
          ) : (
            <Image
              alt={t("preview.coverAlt")}
              className={cn(
                "object-cover transition-opacity duration-500 ease-out",
                coverLoaded ? "opacity-100" : "motion-safe:opacity-0",
              )}
              fill
              onLoad={() => setCoverLoaded(true)}
              sizes="96px"
              src={coverSrc}
              unoptimized
            />
          )}
          {isFavorite ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-card text-primary shadow-soft"
            >
              <UiIcon name="heart" size={13} />
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <h2
            className="font-heading text-lg leading-tight font-semibold text-ink data-[empty=true]:text-muted-foreground"
            data-empty={!hasTitle}
          >
            {hasTitle ? title : t("preview.titlePlaceholder")}
          </h2>
          <p
            className="text-sm text-foreground/80 data-[empty=true]:text-muted-foreground"
            data-empty={!hasAuthor}
          >
            {hasAuthor ? authorName : t("preview.authorPlaceholder")}
          </p>
          {hasPublisher ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UiIcon className="shrink-0" name="building" size={14} />
              <span className="min-w-0 truncate">{publisherName}</span>
            </p>
          ) : null}
          {showRating ? <Rating className="mt-0.5" size="sm" value={rating} /> : null}
        </div>
      </div>

      {readingEntry !== null || ownershipEntry !== null ? (
        <div className="flex flex-wrap gap-2">
          {readingEntry === null || readingStatus === undefined ? null : (
            <StatusBadge
              entry={{ ...readingEntry, label: t(`readingStatus.options.${readingStatus}`) }}
            />
          )}
          {ownershipEntry === null || ownershipStatus === undefined ? null : (
            <StatusBadge
              entry={{ ...ownershipEntry, label: t(`ownershipStatus.options.${ownershipStatus}`) }}
            />
          )}
        </div>
      ) : null}

      {formats.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted-foreground uppercase">
            {t("preview.formatsLabel")}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {formats.map((value) => (
              <li
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-tag px-2.5 py-1 text-xs font-medium text-tag-foreground"
                key={value}
              >
                <UiIcon className="shrink-0 text-icon" name={FORMAT_ICONS[value]} size={14} />
                {t(`format.options.${value}`)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {visibleGenres.length > 0 ? (
        <ChipRow>
          {visibleGenres.map((value) => (
            <ChipPill key={value}>{value}</ChipPill>
          ))}
          {genresOverflow > 0 ? (
            <ChipPill muted>{t("preview.genresMore", { count: genresOverflow })}</ChipPill>
          ) : null}
        </ChipRow>
      ) : null}

      {visibleTags.length > 0 ? (
        <ChipRow>
          {visibleTags.map((value) => (
            <ChipPill icon="hash" key={value} tone="hash">
              {value}
            </ChipPill>
          ))}
          {tagsOverflow > 0 ? (
            <ChipPill muted tone="hash">
              {t("preview.tagsMore", { count: tagsOverflow })}
            </ChipPill>
          ) : null}
        </ChipRow>
      ) : null}

      {isFavorite || inQueue ? (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {isFavorite ? (
            <span className="inline-flex items-center gap-1.5">
              <UiIcon className="shrink-0 text-primary" name="heart" size={14} />
              {t("preview.favorite")}
            </span>
          ) : null}
          {inQueue ? (
            <span className="inline-flex items-center gap-1.5">
              <UiIcon className="shrink-0 text-primary" name="bookmark" size={14} />
              {t("preview.inQueue")}
            </span>
          ) : null}
        </div>
      ) : null}

      {description.trim().length > 0 ? (
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
    </aside>
  );
}

function ChipPill({
  children,
  icon,
  muted = false,
  tone = "genre",
}: {
  children: ReactNode;
  icon?: UiIconName;
  muted?: boolean;
  tone?: "genre" | "hash";
}) {
  return (
    <li
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "genre"
          ? "border-border bg-tag text-tag-foreground"
          : "border-border bg-secondary/60 text-foreground/80",
        muted ? "text-muted-foreground" : null,
      )}
    >
      {icon === undefined ? null : (
        <UiIcon className="shrink-0 text-muted-foreground" name={icon} size={12} />
      )}
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return <ul className="flex flex-wrap gap-1.5">{children}</ul>;
}

function entryFor(
  entries: readonly StatusEntry[],
  value: string | undefined,
  defaultValue: string,
): null | StatusEntry {
  if (value === undefined || value === defaultValue) return null;
  return entries.find((entry) => entry.value === value) ?? null;
}

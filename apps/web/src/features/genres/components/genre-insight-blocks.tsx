"use client";

import type { GenresOverviewView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { formatRelativeTime } from "@/lib/format";

import { genreLibraryHref, unratedFinishedLibraryHref } from "../model/genre-links";
import { genreTenure } from "../model/genre-tenure";
import { GenreBadge } from "./genre-badge";

type GenreInsightBlocksProps = {
  overview: GenresOverviewView;
};

type GenreInsightRowProps = {
  genreKey: string;
  href: string;
  label: string;
  meta: ReactNode;
};

export function GenreInsightBlocks({ overview }: GenreInsightBlocksProps) {
  return (
    <>
      <DormantGenresBlock genres={overview.dormantGenres} />
      <NewForYouGenresBlock genres={overview.newForYouGenres} />
      <UnratedFinishedGenresBlock genres={overview.unratedFinishedGenres} />
    </>
  );
}

function DormantGenresBlock({ genres }: { genres: GenresOverviewView["dormantGenres"] }) {
  const t = useTranslations("genres.insights.dormant");
  const locale = useLocale();
  if (genres.length === 0) return null;

  return (
    <InsightBlock title={t("title")}>
      {genres.map((genre) => (
        <GenreInsightRow
          genreKey={genre.key}
          href={genreLibraryHref(genre.key)}
          key={genre.key}
          label={genre.label}
          meta={
            <>
              <span>{formatRelativeTime(genre.lastReadingActivityAt, locale)}</span>
              <span>{t("progress", { read: genre.readCount, total: genre.booksCount })}</span>
            </>
          }
        />
      ))}
    </InsightBlock>
  );
}

function GenreInsightRow({ genreKey, href, label, meta }: GenreInsightRowProps) {
  return (
    <li>
      <MobilePageOverviewLink
        className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-secondary/80"
        href={href}
      >
        <GenreBadge genreKey={genreKey} size="row" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium break-words text-ink">{label}</span>
          <span className="flex flex-col text-xs text-muted-foreground">{meta}</span>
        </span>
        <UiIcon
          aria-hidden
          className="shrink-0 text-muted-foreground"
          name="chevron-right"
          size={16}
        />
      </MobilePageOverviewLink>
    </li>
  );
}

function InsightBlock({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description?: string;
  title: string;
}) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="sidebar-card-leaf flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="font-heading text-sm font-semibold text-ink" id={headingId}>
          {title}
        </h2>
        {description === undefined ? null : (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

function NewForYouGenresBlock({ genres }: { genres: GenresOverviewView["newForYouGenres"] }) {
  const t = useTranslations("genres.insights.newForYou");
  if (genres.length === 0) return null;

  const now = new Date();

  return (
    <InsightBlock title={t("title")}>
      {genres.map((genre) => {
        const tenure = genreTenure(genre.firstAddedAt, now);
        return (
          <GenreInsightRow
            genreKey={genre.key}
            href={genreLibraryHref(genre.key)}
            key={genre.key}
            label={genre.label}
            meta={
              <>
                <span>{t("booksCount", { count: genre.booksCount })}</span>
                <span>{t(`tenure.${tenure.unit}`, { count: tenure.count })}</span>
              </>
            }
          />
        );
      })}
    </InsightBlock>
  );
}

function UnratedFinishedGenresBlock({
  genres,
}: {
  genres: GenresOverviewView["unratedFinishedGenres"];
}) {
  const t = useTranslations("genres.insights.unrated");
  if (genres.length === 0) return null;

  return (
    <InsightBlock description={t("description")} title={t("title")}>
      {genres.map((genre) => (
        <GenreInsightRow
          genreKey={genre.key}
          href={unratedFinishedLibraryHref(genre.key)}
          key={genre.key}
          label={genre.label}
          meta={<span>{t("count", { count: genre.unratedFinishedCount })}</span>}
        />
      ))}
    </InsightBlock>
  );
}

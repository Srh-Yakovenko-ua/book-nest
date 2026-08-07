"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { SeriesCoverBook } from "../model/series-details-derive";

const MAX_FAN_LAYERS = 3;

const FAN_LAYER_CLASSES = [
  "relative z-30 shadow-card",
  "absolute top-0 left-0 z-20 translate-x-[6px] shadow-sm",
  "absolute top-0 left-0 z-10 translate-x-[12px] shadow-sm",
] as const;

const MOBILE_COMPACT = {
  badge: "max-sm:gap-1 max-sm:px-1.5 max-sm:py-0.5 max-sm:text-[0.625rem]",
  frame: "max-sm:w-[4.5rem]",
} as const;

type SeriesCardCoverProps = {
  alt: string;
  booksInSeries: number;
  covers: SeriesCoverBook[];
  mobileCompact?: boolean;
  name: string;
  showBadge?: boolean;
  totalBooks: Nullable<number>;
};

export function SeriesCardCover({
  alt,
  booksInSeries,
  covers,
  mobileCompact,
  name,
  showBadge = true,
  totalBooks,
}: SeriesCardCoverProps) {
  const t = useTranslations("series.card");
  const layers = covers.slice(0, MAX_FAN_LAYERS);
  const compact = mobileCompact === true ? MOBILE_COMPACT : null;

  return (
    <div aria-label={alt} className={cn("relative w-24 shrink-0", compact?.frame)} role="img">
      {layers.length === 0 ? (
        <div className="relative grid aspect-[2/3] place-items-center overflow-hidden rounded-lg border border-border bg-accent text-accent-foreground shadow-card">
          <UiIcon
            className="absolute top-1.5 right-1.5 text-accent-foreground/40"
            name="layers"
            size={14}
          />
          <span className="font-heading text-lg font-bold text-accent-foreground/85">
            {seriesInitials(name)}
          </span>
        </div>
      ) : (
        layers.map((cover, index) => (
          <SeriesCardCoverLayer
            className={cn(FAN_LAYER_CLASSES[index], compact?.frame)}
            cover={cover}
            key={cover.id}
          />
        ))
      )}

      {totalBooks !== null && showBadge && (
        <span
          className={cn(
            "absolute bottom-0 left-0 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground shadow-card",
            compact?.badge,
          )}
        >
          <UiIcon aria-hidden className="shrink-0 text-icon" name="book" size={13} />
          {t("coverBadge", { added: booksInSeries, total: totalBooks })}
        </span>
      )}
    </div>
  );
}

function SeriesCardCoverLayer({ className, cover }: { className: string; cover: SeriesCoverBook }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = cover.title.trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "aspect-[2/3] w-24 overflow-hidden rounded-lg border border-border bg-accent",
        className,
      )}
    >
      {failed ? (
        <div className="grid h-full w-full place-items-center text-accent-foreground">
          {initial.length === 0 ? (
            <UiIcon name="book" size={20} />
          ) : (
            <span className="font-heading text-lg leading-none font-semibold">{initial}</span>
          )}
        </div>
      ) : (
        <Image
          alt={cover.title}
          className={cn(
            "object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "motion-safe:opacity-0",
          )}
          fill
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          sizes="110px"
          src={cover.src}
          unoptimized
        />
      )}
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

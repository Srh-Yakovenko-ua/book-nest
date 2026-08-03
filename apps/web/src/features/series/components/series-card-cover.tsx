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
  "absolute top-0 left-0 z-20 translate-x-[6px] rotate-[3deg] shadow-sm",
  "absolute top-0 left-0 z-10 translate-x-[12px] rotate-[6deg] shadow-sm",
] as const;

type SeriesCardCoverProps = {
  alt: string;
  booksInSeries: number;
  covers: SeriesCoverBook[];
  name: string;
  totalBooks: Nullable<number>;
};

export function SeriesCardCover({
  alt,
  booksInSeries,
  covers,
  name,
  totalBooks,
}: SeriesCardCoverProps) {
  const t = useTranslations("series.card");
  const layers = covers.slice(0, MAX_FAN_LAYERS);

  return (
    <div aria-label={alt} className="relative w-[90px] shrink-0" role="img">
      {layers.length === 0 ? (
        <div className="relative grid aspect-[3/4] w-[74px] place-items-center overflow-hidden rounded-lg border border-border bg-accent text-accent-foreground shadow-card">
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
            className={cn(FAN_LAYER_CLASSES[index])}
            cover={cover}
            key={cover.id}
          />
        ))
      )}

      {totalBooks !== null && (
        <span className="absolute bottom-0 left-0 z-40 inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[0.6875rem] font-medium whitespace-nowrap text-muted-foreground shadow-card">
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
        "aspect-[3/4] w-[74px] origin-bottom-left overflow-hidden rounded-lg border border-border bg-accent",
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
          sizes="90px"
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

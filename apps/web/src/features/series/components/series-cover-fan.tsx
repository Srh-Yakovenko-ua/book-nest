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
  "z-30 shadow-detail-cover",
  "z-20 translate-x-2 rotate-[5deg] shadow-card",
  "z-10 translate-x-4 rotate-[10deg] shadow-card",
] as const;

type SeriesCoverFanProps = {
  booksInSeries: number;
  covers: SeriesCoverBook[];
  name: string;
  totalBooks: Nullable<number>;
};

export function SeriesCoverFan({ booksInSeries, covers, name, totalBooks }: SeriesCoverFanProps) {
  const t = useTranslations("series.details");
  const layers = covers.slice(0, MAX_FAN_LAYERS);
  const isFanned = layers.length > 1;
  const countLabel =
    totalBooks === null
      ? t("books", { count: booksInSeries })
      : t("booksWithTotal", { count: booksInSeries, total: totalBooks });

  return (
    <div
      aria-label={t("coverFanAlt", { count: booksInSeries, name })}
      className={cn(
        "relative mx-auto shrink-0 sm:mx-0",
        isFanned ? "h-[196px] w-[176px] sm:h-[220px] sm:w-[196px]" : "aspect-[3/4] w-32 sm:w-36",
      )}
      role="img"
    >
      {layers.map((cover, index) => (
        <SeriesCoverFanLayer
          className={cn(
            FAN_LAYER_CLASSES[index],
            isFanned ? "bottom-4 left-0 aspect-[3/4] w-32 sm:w-36" : "inset-0",
          )}
          cover={cover}
          key={cover.id}
        />
      ))}

      <span className="absolute bottom-0 left-0 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground shadow-card">
        <UiIcon className="text-icon" name="book" size={13} />
        {countLabel}
      </span>
    </div>
  );
}

function SeriesCoverFanLayer({ className, cover }: { className: string; cover: SeriesCoverBook }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = cover.title.trim().charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "absolute origin-bottom overflow-hidden rounded-xl border border-border bg-accent",
        className,
      )}
    >
      {failed ? (
        <div className="grid h-full w-full place-items-center text-accent-foreground">
          {initial.length === 0 ? (
            <UiIcon name="book" size={32} />
          ) : (
            <span className="font-heading text-4xl leading-none font-semibold">{initial}</span>
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
          sizes="144px"
          src={cover.src}
          unoptimized
        />
      )}
    </div>
  );
}

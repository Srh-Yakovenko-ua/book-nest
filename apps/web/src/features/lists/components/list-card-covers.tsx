"use client";

import type { MediaView } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";

const MAX_COVERS = 4;

export const LIST_CARD_COVERS_ROW = "grid min-h-14 grid-cols-4 items-center gap-2";

type ListCardCoversProps = {
  bookCount: number;
  coverAlt: string;
  covers: MediaView[];
};

export function ListCardCovers({ bookCount, coverAlt, covers }: ListCardCoversProps) {
  const visible = covers.slice(0, MAX_COVERS);
  const placeholderCount = Math.max(0, Math.min(MAX_COVERS, bookCount) - visible.length);

  return (
    <div className={LIST_CARD_COVERS_ROW}>
      {visible.map((cover) => (
        <CoverTile alt={coverAlt} key={cover.id} src={cover.urls.thumb} />
      ))}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <PlaceholderTile key={index} />
      ))}
    </div>
  );
}

export function ListCardCoversEmpty({ label }: { label: string }) {
  return (
    <div className={`relative ${LIST_CARD_COVERS_ROW}`}>
      <span aria-hidden className="aspect-[3/4]" />
      <span className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-accent/40 px-3 text-center text-[0.8125rem] text-muted-foreground">
        <UiIcon aria-hidden className="shrink-0 text-icon" name="list" size={16} />
        {label}
      </span>
    </div>
  );
}

function CoverTile({ alt, src }: { alt: string; src: string }) {
  return (
    <span className="relative aspect-[3/4] overflow-hidden rounded-md bg-accent shadow-soft">
      <Image alt={alt} className="object-cover" fill sizes="48px" src={src} unoptimized />
    </span>
  );
}

function PlaceholderTile() {
  return (
    <span className="grid aspect-[3/4] place-items-center rounded-md bg-accent text-accent-foreground/60">
      <UiIcon name="book" size={18} />
    </span>
  );
}

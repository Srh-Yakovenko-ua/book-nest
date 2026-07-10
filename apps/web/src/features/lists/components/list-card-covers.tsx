"use client";

import type { MediaView } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";

const MAX_COVERS = 4;

type ListCardCoversProps = {
  bookCount: number;
  coverAlt: string;
  covers: MediaView[];
};

export function ListCardCovers({ bookCount, coverAlt, covers }: ListCardCoversProps) {
  const visible = covers.slice(0, MAX_COVERS);
  const placeholderCount = Math.max(0, Math.min(MAX_COVERS, bookCount) - visible.length);

  return (
    <div className="grid grid-cols-4 gap-2">
      {visible.map((cover) => (
        <CoverTile alt={coverAlt} key={cover.id} src={cover.urls.thumb} />
      ))}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <PlaceholderTile key={index} />
      ))}
    </div>
  );
}

function CoverTile({ alt, src }: { alt: string; src: string }) {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-accent shadow-soft">
      <Image alt={alt} className="object-cover" fill sizes="80px" src={src} unoptimized />
    </div>
  );
}

function PlaceholderTile() {
  return (
    <div className="grid aspect-[3/4] place-items-center rounded-md bg-accent text-accent-foreground/60">
      <UiIcon name="book" size={20} />
    </div>
  );
}

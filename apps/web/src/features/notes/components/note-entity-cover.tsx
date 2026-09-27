import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { NOTE_ENTITY_PLACEMENT } from "./note-entity-placement";

type NoteEntityCoverProps = {
  alt: string;
  cover: Nullable<MediaView>;
  href: string;
  icon: UiIconName;
  placement: NoteEntityPlacement;
};

export function NoteEntityCover({ alt, cover, href, icon, placement }: NoteEntityCoverProps) {
  const { cover: size } = NOTE_ENTITY_PLACEMENT[placement];
  const src = cover?.urls.thumb ?? null;

  return (
    <Link
      aria-hidden
      className="shrink-0 cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
      tabIndex={-1}
    >
      {src === null ? (
        <span
          aria-label={alt}
          className={cn(
            "grid aspect-[3/4] place-items-center rounded-md bg-accent text-accent-foreground/70",
            size.className,
          )}
          role="img"
        >
          <UiIcon name={icon} size={size.iconSize} />
        </span>
      ) : (
        <span
          className={cn(
            "relative block aspect-[3/4] overflow-hidden rounded-md bg-accent",
            size.className,
          )}
        >
          <Image alt={alt} className="object-cover" fill sizes={size.sizes} src={src} unoptimized />
        </span>
      )}
    </Link>
  );
}

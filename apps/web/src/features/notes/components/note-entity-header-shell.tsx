"use client";

import type { MediaView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import type { UiIconName } from "@/components/icons";

import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";

import type { NoteEntityPlacement } from "./note-entity-placement";

import { NoteEntityCover } from "./note-entity-cover";
import { NOTE_ENTITY_PLACEMENT } from "./note-entity-placement";

type NoteEntityHeaderShellProps = {
  cover: Nullable<MediaView>;
  coverAlt: string;
  href: string;
  icon: UiIconName;
  meta: ReactNode;
  placement: NoteEntityPlacement;
  title: string;
};

export function NoteEntityHeaderShell({
  cover,
  coverAlt,
  href,
  icon,
  meta,
  placement,
  title,
}: NoteEntityHeaderShellProps) {
  const titleLink = (
    <Link
      className="cursor-pointer rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
      href={href}
    >
      {title}
    </Link>
  );

  return (
    <div className="flex min-w-0 items-start gap-3">
      <NoteEntityCover alt={coverAlt} cover={cover} href={href} icon={icon} placement={placement} />
      <div className="flex min-w-0 flex-col gap-0.5">
        {placement === "fullView" ? (
          <>
            <DialogTitle className={NOTE_ENTITY_PLACEMENT.fullView.title}>{titleLink}</DialogTitle>
            <DialogDescription asChild>
              <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">{meta}</div>
            </DialogDescription>
          </>
        ) : (
          <>
            <h3 className={NOTE_ENTITY_PLACEMENT.card.title}>{titleLink}</h3>
            <div className="flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
              {meta}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

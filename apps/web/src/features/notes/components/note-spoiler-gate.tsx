"use client";

import type { NoteEntityType } from "@app/shared";

import { useTranslations } from "next-intl";

import { SpoilerGate } from "@/components/spoiler-gate";
import { Button } from "@/components/ui/button";

import type { NoteCardLayout } from "./note-card-layout";

import { NOTE_CARD_LAYOUT } from "./note-card-layout";

type NoteSpoilerGateProps = {
  entityType: NoteEntityType;
  layout: NoteCardLayout;
  onOpen: (trigger: HTMLButtonElement) => void;
};

export function NoteSpoilerGate({ entityType, layout, onOpen }: NoteSpoilerGateProps) {
  const t = useTranslations("notes.card.spoilerGate");

  return (
    <SpoilerGate
      action={
        <Button className="h-11 sm:h-8" onClick={(event) => onOpen(event.currentTarget)} size="sm">
          {t("show")}
        </Button>
      }
      className={NOTE_CARD_LAYOUT[layout].gate}
      description={t(`description.${entityType}`)}
      title={t("title")}
    />
  );
}

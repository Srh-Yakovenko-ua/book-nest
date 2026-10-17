"use client";

import type { CharacterFactView, Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CharacterFactLocation } from "./character-fact-location";

type CharacterFactFullViewDialogProps = {
  fact: CharacterFactView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  triggerRef: RefObject<Nullable<HTMLButtonElement>>;
};

export function CharacterFactFullViewDialog({
  fact,
  onOpenChange,
  open,
  triggerRef,
}: CharacterFactFullViewDialogProps) {
  const t = useTranslations("characters.facts.fullView");
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef.current;
          if (trigger === null || !trigger.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => bodyRef.current?.focus());
        }}
      >
        <DialogHeader className="min-w-0 pr-8 text-left">
          <DialogTitle className="leading-snug wrap-anywhere">{fact.title}</DialogTitle>
        </DialogHeader>

        <div
          aria-label={t("textLabel")}
          className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto rounded-md px-1 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          ref={bodyRef}
          role="region"
          tabIndex={0}
        >
          <p className="rounded-lg border border-border bg-secondary/40 p-4 text-base leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
            {fact.text}
          </p>
          <CharacterFactLocation chapter={fact.chapter} page={fact.page} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { CharacterFactView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useFittedLineClamp } from "@/hooks/use-fitted-line-clamp";

import { CharacterFactActionsMenu } from "./character-fact-actions-menu";
import { CharacterFactFullViewDialog } from "./character-fact-full-view-dialog";
import { CharacterFactLocation } from "./character-fact-location";

type CharacterFactCardProps = {
  fact: CharacterFactView;
  onDelete: (fact: CharacterFactView, trigger: Nullable<HTMLElement>) => void;
  onEdit: (fact: CharacterFactView, trigger: Nullable<HTMLElement>) => void;
};

export function CharacterFactCard({ fact, onDelete, onEdit }: CharacterFactCardProps) {
  const t = useTranslations("characters.facts.card");
  const titleId = useId();
  const { isClamped: isTitleClamped, ref: titleRef } = useFittedLineClamp<HTMLSpanElement>(
    fact.title,
  );
  const { isClamped: isTextClamped, ref: textRef } = useFittedLineClamp<HTMLParagraphElement>(
    fact.text,
  );
  const fullViewTriggerRef = useRef<Nullable<HTMLElement>>(null);
  const [isFullViewOpen, setFullViewOpen] = useState(false);

  function openFullView(trigger: HTMLElement) {
    fullViewTriggerRef.current = trigger;
    setFullViewOpen(true);
  }

  return (
    <article className="relative flex w-full min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-accent-border">
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <div className="flex w-full min-w-0 items-start gap-2">
          <h3
            className="min-w-0 flex-1 font-heading text-base leading-snug font-semibold wrap-anywhere text-ink"
            id={titleId}
          >
            <button
              className="w-full cursor-pointer text-left outline-hidden after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
              onClick={(event) => openFullView(event.currentTarget)}
              type="button"
            >
              <span className="line-clamp-2" ref={titleRef}>
                {fact.title}
              </span>
            </button>
          </h3>
          <CharacterFactActionsMenu
            factId={fact.id}
            factTitle={fact.title}
            onDelete={(trigger) => onDelete(fact, trigger)}
            onEdit={(trigger) => onEdit(fact, trigger)}
          />
        </div>
        <p
          className="line-clamp-4 w-full text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground"
          ref={textRef}
        >
          {fact.text}
        </p>
        {isTitleClamped || isTextClamped ? (
          <Button
            aria-describedby={titleId}
            className="relative z-10 h-auto p-0"
            onClick={(event) => openFullView(event.currentTarget)}
            size="sm"
            variant="link"
          >
            {t("readMore")}
          </Button>
        ) : null}
      </div>

      <CharacterFactLocation chapter={fact.chapter} className="mt-auto" page={fact.page} />

      <CharacterFactFullViewDialog
        fact={fact}
        onOpenChange={setFullViewOpen}
        open={isFullViewOpen}
        triggerRef={fullViewTriggerRef}
      />
    </article>
  );
}

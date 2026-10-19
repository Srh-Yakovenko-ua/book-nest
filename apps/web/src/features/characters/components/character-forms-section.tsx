"use client";

import type { CharacterDetailsView, CharacterFormView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/features/books";
import { ImageViewerDialog } from "@/features/media";
import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { cn } from "@/lib/utils";

import {
  type CharacterRevealControl,
  isFieldHidden,
  REVEAL_FOCUS_TARGET,
  revealFocusTarget,
} from "../model/character-spoiler";
import { CharacterHiddenGroupNotice } from "./character-hidden-group-notice";

type CharacterFormsSectionProps = {
  character: CharacterDetailsView;
  reveal: CharacterRevealControl;
};

const FORMS_LIST = {
  collapsedCount: 4,
  teaserLines: 3,
} as const;

export function CharacterFormsSection({ character, reveal }: CharacterFormsSectionProps) {
  const t = useTranslations("characters.page");
  const [showAll, setShowAll] = useState(false);
  const listId = useId();

  const { forms } = character;
  const formsHidden = isFieldHidden(character.hiddenFields, "forms");
  const canToggle = forms.length > FORMS_LIST.collapsedCount;
  const shownForms = showAll || !canToggle ? forms : forms.slice(0, FORMS_LIST.collapsedCount);

  if (forms.length === 0 && !formsHidden) return null;

  async function revealForms() {
    if (await reveal.onReveal("forms")) setShowAll(true);
  }

  return (
    <FormSection icon="layers" title={t("formsSection")}>
      <div
        aria-label={t("formsSection")}
        className={cn("flex flex-col gap-4 rounded-lg", REVEAL_FOCUS_TARGET.focusClassName)}
        role="group"
        {...revealFocusTarget("forms")}
      >
        {shownForms.length === 0 ? null : (
          <ul className="grid gap-3 md:grid-cols-2" id={listId}>
            {shownForms.map((form) => (
              <CharacterFormCard form={form} key={form.id} />
            ))}
          </ul>
        )}
        {canToggle ? (
          <Button
            aria-controls={listId}
            aria-expanded={showAll}
            className="self-start"
            onClick={() => setShowAll((value) => !value)}
            size="sm"
            variant="ghost"
          >
            {showAll ? t("collapse") : t("showAllForms")}
          </Button>
        ) : null}
        {formsHidden ? (
          <CharacterHiddenGroupNotice
            actionLabel={t("revealHiddenForms")}
            message={t("hiddenFormsNotice")}
            onReveal={() => void revealForms()}
            revealing={reveal.pending === "forms"}
          />
        ) : null}
      </div>
    </FormSection>
  );
}

function CharacterFormCard({ form }: { form: CharacterFormView }) {
  const t = useTranslations("characters.page");
  const tFormType = useTranslations("characters.formType");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const descriptionId = useId();

  const description = form.description?.trim() ?? "";
  const { containerRef, contentRef, isClamped } = useAnimatedHeight<HTMLParagraphElement>({
    collapsedHeight: collapsedTeaserHeight,
    contentKey: `${description}:${descriptionExpanded}`,
    expanded: false,
  });
  const canExpand = descriptionExpanded || isClamped;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="flex gap-3">
        {form.portrait === null ? (
          <span
            aria-hidden
            className="grid aspect-[3/4] w-[72px] shrink-0 place-items-center rounded-md bg-accent text-accent-foreground/70 sm:w-20"
          >
            <UiIcon name="user-round" size={24} />
          </span>
        ) : (
          <button
            aria-label={t("openFormPortrait", { name: form.name })}
            className="relative aspect-[3/4] w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-md bg-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-20"
            onClick={() => setViewerOpen(true)}
            type="button"
          >
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="80px"
              src={form.portrait.urls.card}
              unoptimized
            />
          </button>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-sm font-semibold break-words text-foreground">{form.name}</h3>
          <p className="text-xs text-muted-foreground">{tFormType(form.formType)}</p>
          {description.length === 0 || descriptionExpanded ? null : (
            <div className="overflow-hidden" ref={containerRef}>
              <p
                className="text-sm leading-relaxed whitespace-pre-line text-foreground/90"
                ref={contentRef}
              >
                {description}
              </p>
            </div>
          )}
          {description.length > 0 && canExpand ? (
            <button
              aria-controls={descriptionExpanded ? descriptionId : undefined}
              aria-expanded={descriptionExpanded}
              className="inline-flex cursor-pointer self-start text-sm font-medium text-primary hover:text-primary/80"
              onClick={() => setDescriptionExpanded((value) => !value)}
              type="button"
            >
              {descriptionExpanded ? t("collapseDescription") : t("readFullDescription")}
            </button>
          ) : null}
        </div>
      </div>

      {descriptionExpanded ? (
        <p
          className="text-sm leading-relaxed whitespace-pre-line text-foreground/90"
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}

      {form.portrait === null ? null : (
        <ImageViewerDialog
          alt={form.name}
          onOpenChange={setViewerOpen}
          open={viewerOpen}
          src={form.portrait.urls.full}
          title={form.name}
        />
      )}
    </li>
  );
}

function collapsedTeaserHeight(content: HTMLParagraphElement): number {
  const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight);
  if (Number.isNaN(lineHeight)) return content.scrollHeight;
  return Math.round(lineHeight * FORMS_LIST.teaserLines);
}

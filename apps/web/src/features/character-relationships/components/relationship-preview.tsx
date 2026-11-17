"use client";

import type { Nullable } from "@app/shared";

import { ArrowLeft, ArrowLeftRight, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { RelationshipCreateSemantics } from "../model/relationship-create-semantics";

import { toEffectiveCreateEndpoints } from "../model/relationship-create-semantics";
import { useRelationshipSemanticsText } from "../model/use-relationship-semantics-text";

const RELATIONSHIP_PREVIEW = {
  announceDelayMs: 800,
  arrows: { backward: ArrowLeft, both: ArrowLeftRight, forward: ArrowRight },
} as const;

type PreviewArrow = keyof typeof RELATIONSHIP_PREVIEW.arrows;

type RelationshipPreviewProps = {
  announcedSemantics: Nullable<RelationshipCreateSemantics>;
  semantics: Nullable<RelationshipCreateSemantics>;
};

export function RelationshipPreview({ announcedSemantics, semantics }: RelationshipPreviewProps) {
  const t = useTranslations("relationships.editor.preview");
  const text = useRelationshipSemanticsText();
  const titleId = useId();
  const sentence = semantics === null ? "" : text.sentence(semantics);
  const announcement = useDebouncedValue(
    announcedSemantics === null ? "" : text.sentence(announcedSemantics),
    RELATIONSHIP_PREVIEW.announceDelayMs,
  );

  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3"
    >
      <span className="text-sm font-medium text-foreground" id={titleId}>
        {t("title")}
      </span>
      {semantics === null ? (
        <p className="text-sm text-muted-foreground">{t("placeholder")}</p>
      ) : (
        <>
          <RelationshipPreviewPair semantics={semantics} />
          <span className="flex max-w-full min-w-0 self-start rounded-full bg-tag px-2.5 py-0.5 text-xs font-medium text-tag-foreground">
            <TruncatedText text={text.typeLabel(semantics)} />
          </span>
          <p className="text-sm wrap-anywhere text-muted-foreground">{sentence}</p>
        </>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

export function RelationshipPreviewPair({ semantics }: { semantics: RelationshipCreateSemantics }) {
  const Arrow = RELATIONSHIP_PREVIEW.arrows[previewArrow(semantics)];

  return (
    <div
      aria-hidden
      className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground"
    >
      <TruncatedText text={semantics.participantA.name} />
      <Arrow className="size-4 shrink-0 text-primary" />
      <TruncatedText text={semantics.participantB.name} />
    </div>
  );
}

function previewArrow(semantics: RelationshipCreateSemantics): PreviewArrow {
  if (semantics.directionality === "symmetric") return "both";
  const { source } = toEffectiveCreateEndpoints(semantics);
  return source.id === semantics.participantA.id ? "forward" : "backward";
}

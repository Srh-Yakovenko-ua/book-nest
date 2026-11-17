"use client";

import type { Nullable } from "@app/shared";
import type { Ref } from "react";

import { useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";

import type { RelationshipCreateSemantics } from "../model/relationship-create-semantics";

import { useRelationshipSemanticsText } from "../model/use-relationship-semantics-text";
import { RelationshipPreviewPair } from "./relationship-preview";

type RelationshipCreateBookSummaryProps = {
  bookTitle: Nullable<string>;
  headingRef: Ref<HTMLHeadingElement>;
  semantics: Nullable<RelationshipCreateSemantics>;
};

export function RelationshipCreateBookSummary({
  bookTitle,
  headingRef,
  semantics,
}: RelationshipCreateBookSummaryProps) {
  const t = useTranslations("relationships.editor");
  const text = useRelationshipSemanticsText();

  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2">
      <h3
        className="text-sm font-medium wrap-anywhere text-foreground outline-none"
        ref={headingRef}
        tabIndex={-1}
      >
        <span className="sr-only">{t("steps.bookHeading")} </span>
        {bookTitle ?? t("book.current")}
      </h3>
      {semantics === null ? null : (
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <RelationshipPreviewPair semantics={semantics} />
          <span aria-hidden className="flex min-w-0 items-center gap-2">
            <span>·</span>
            <TruncatedText text={text.typeLabel(semantics)} />
          </span>
          <span className="sr-only">{text.sentence(semantics)}</span>
        </div>
      )}
    </div>
  );
}

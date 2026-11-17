"use client";

import { useTranslations } from "next-intl";

import type { RelationshipCreateSemantics } from "./relationship-create-semantics";

import { toEffectiveCreateEndpoints } from "./relationship-create-semantics";
import { useRelationshipLabels } from "./use-relationship-labels";

export function useRelationshipSemanticsText() {
  const t = useTranslations("relationships.editor.preview");
  const labels = useRelationshipLabels();

  function typeLabel(semantics: RelationshipCreateSemantics): string {
    return semantics.customName ?? labels.type(semantics.type);
  }

  function sentence(semantics: RelationshipCreateSemantics): string {
    if (semantics.directionality === "symmetric") {
      return t("symmetric", {
        first: semantics.participantA.name,
        second: semantics.participantB.name,
      });
    }
    const { source, target } = toEffectiveCreateEndpoints(semantics);
    return t("directed", { source: source.name, target: target.name, type: typeLabel(semantics) });
  }

  return { sentence, typeLabel };
}

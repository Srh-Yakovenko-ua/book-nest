"use client";

import type { SafeRelationshipEdgeView } from "@app/shared";

import { useTranslations } from "next-intl";

import { SpoilerGate } from "@/components/spoiler-gate";
import { Badge } from "@/components/ui/badge";

import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipRevealButton } from "./relationship-reveal-button";

type RelationshipTypeSectionProps = {
  isRevealPending: boolean;
  onReveal: () => void;
  relationship: SafeRelationshipEdgeView;
};

export function RelationshipTypeSection({
  isRevealPending,
  onReveal,
  relationship,
}: RelationshipTypeSectionProps) {
  const t = useTranslations("relationships");
  const labels = useRelationshipLabels();

  if (relationship.typeHidden) {
    return (
      <SpoilerGate
        action={
          <RelationshipRevealButton isPending={isRevealPending} onReveal={onReveal}>
            {t("details.type.reveal")}
          </RelationshipRevealButton>
        }
        description={t("details.type.hiddenDescription")}
        title={t("details.type.hiddenTitle")}
        variant="compact"
      />
    );
  }

  const typeLabel = labels.edgeType(relationship);
  const roles = [
    { label: relationship.sourceLabel, name: relationship.source.name },
    { label: relationship.targetLabel, name: relationship.target.name },
  ].flatMap(({ label, name }) => (label === null ? [] : [{ label, name }]));

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">{t("details.type.heading")}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {relationship.category === null ? null : (
          <li>
            <Badge variant="primary">{labels.category(relationship.category)}</Badge>
          </li>
        )}
        {typeLabel === null ? null : (
          <li className="max-w-full">
            <Badge className="max-w-full" variant="outline">
              <span className="truncate">{typeLabel}</span>
            </Badge>
          </li>
        )}
        <li>
          <Badge variant="secondary">{labels.directionality(relationship.directionality)}</Badge>
        </li>
        {relationship.isCanonical === true ? (
          <li>
            <Badge variant="info">{t("card.canonical")}</Badge>
          </li>
        ) : null}
      </ul>
      {roles.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <h4 className="text-xs font-semibold text-muted-foreground">{t("details.labels")}</h4>
          <ul className="flex flex-col gap-0.5 text-sm text-foreground">
            {roles.map((role) => (
              <li className="wrap-anywhere" key={role.name}>
                {t("card.participantLabel", role)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

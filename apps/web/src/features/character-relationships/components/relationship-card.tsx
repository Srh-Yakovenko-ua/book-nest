"use client";

import type {
  CharacterRelationshipListItemView,
  Nullable,
  SafeBookStateView,
  SafeRelationshipEdgeView,
} from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";

import type { RelationshipActions } from "../model/relationship-adapter";

import { hasRelationshipActions } from "../model/relationship-adapter";
import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipActionsMenu } from "./relationship-actions-menu";
import { RelationshipParticipants } from "./relationship-participants";
import { RelationshipStateBadges } from "./relationship-state-badges";

const RELATIONSHIP_CARD = {
  bookSummaryLimit: 3,
} as const;

type RelationshipCardProps = {
  actions: RelationshipActions;
  focusCharacterId: Nullable<string>;
  item: CharacterRelationshipListItemView;
  onOpen: (relationshipId: string) => void;
  showBookSummaries: boolean;
};

export function RelationshipCard({
  actions,
  focusCharacterId,
  item,
  onOpen,
  showBookSummaries,
}: RelationshipCardProps) {
  const t = useTranslations("relationships.card");
  const { bookSummaries, effectiveState, relationship } = item;
  const participantNames = { source: relationship.source.name, target: relationship.target.name };

  return (
    <article
      className="relative flex w-full min-w-0 cursor-pointer flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card transition-colors hover:border-accent-border"
      data-relationship-id={relationship.id}
    >
      <div className="flex min-w-0 items-start gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            aria-label={t("open", participantNames)}
            className="w-full cursor-pointer rounded-md text-left outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
            onClick={() => onOpen(relationship.id)}
            type="button"
          >
            <RelationshipParticipants
              edge={relationship}
              focusCharacterId={focusCharacterId}
              size="card"
            />
          </button>
        </h3>
        {hasRelationshipActions(actions) ? (
          <RelationshipActionsMenu
            actions={actions}
            participantNames={participantNames}
            relationshipId={relationship.id}
          />
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-1.5">
        <RelationshipTypeBadges relationship={relationship} />
        <RelationshipStateBadges state={effectiveState} />
      </ul>

      <RelationshipRoleLabels relationship={relationship} />

      {effectiveState === null ? null : <RelationshipDescriptionExcerpt state={effectiveState} />}

      {showBookSummaries && bookSummaries.length > 0 ? (
        <RelationshipBookSummaries summaries={bookSummaries} />
      ) : null}
    </article>
  );
}

function RelationshipBookSummaries({ summaries }: { summaries: SafeBookStateView[] }) {
  const t = useTranslations("relationships.card");
  const labels = useRelationshipLabels();
  const visible = summaries.slice(0, RELATIONSHIP_CARD.bookSummaryLimit);
  const hiddenCount = summaries.length - visible.length;

  return (
    <ul aria-label={t("books")} className="flex flex-wrap gap-1.5">
      {visible.map((summary) => (
        <li
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-tag px-2.5 py-0.5 text-xs text-tag-foreground"
          key={summary.id}
        >
          <UiIcon className="shrink-0 text-icon" name="book" size={12} />
          <span className="truncate">{summary.bookTitle}</span>
          {summary.status === null ? null : (
            <span className="shrink-0 text-muted-foreground">
              · {labels.status(summary.status)}
            </span>
          )}
        </li>
      ))}
      {hiddenCount > 0 ? (
        <li className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
          {t("moreBooks", { count: hiddenCount })}
        </li>
      ) : null}
    </ul>
  );
}

function RelationshipDescriptionExcerpt({ state }: { state: SafeBookStateView }) {
  const t = useTranslations("relationships.card");

  if (state.description !== null) {
    return (
      <p className="line-clamp-2 text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
        {state.description}
      </p>
    );
  }
  if (!state.descriptionHidden) return null;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <UiIcon className="shrink-0" name="eye-off" size={14} />
      {t("descriptionHidden")}
    </p>
  );
}

function RelationshipRoleLabels({ relationship }: { relationship: SafeRelationshipEdgeView }) {
  const t = useTranslations("relationships.card");
  const roles = (
    [
      { label: relationship.sourceLabel, name: relationship.source.name, side: "source" },
      { label: relationship.targetLabel, name: relationship.target.name, side: "target" },
    ] as const
  ).flatMap(({ label, name, side }) => (label === null ? [] : [{ label, name, side }]));

  if (roles.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
      {roles.map(({ label, name, side }) => (
        <li className="wrap-anywhere" key={side}>
          {t("participantLabel", { label, name })}
        </li>
      ))}
    </ul>
  );
}

function RelationshipTypeBadges({ relationship }: { relationship: SafeRelationshipEdgeView }) {
  const t = useTranslations("relationships.card");
  const labels = useRelationshipLabels();

  if (relationship.typeHidden) {
    return (
      <li>
        <Badge variant="secondary">
          <UiIcon name="eye-off" size={12} />
          {t("typeHidden")}
        </Badge>
      </li>
    );
  }

  const typeLabel = labels.edgeType(relationship);

  return (
    <>
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
      {relationship.isCanonical === true ? (
        <li>
          <Badge variant="info">{t("canonical")}</Badge>
        </li>
      ) : null}
    </>
  );
}

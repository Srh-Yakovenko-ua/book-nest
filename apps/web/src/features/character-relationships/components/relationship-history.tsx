"use client";

import type { Nullable, SafeBookStateView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

import { useRelationshipLabels } from "../model/use-relationship-labels";
import { RelationshipRevealButton } from "./relationship-reveal-button";
import { RelationshipStateBadges } from "./relationship-state-badges";

type RelationshipBookStateItemProps = {
  canRevealDescription: boolean;
  isRevealPending: boolean;
  onRevealDescription: (state: SafeBookStateView) => void;
  state: SafeBookStateView;
};

type RelationshipHistoryProps = {
  canRevealDescription: boolean;
  onRevealDescription: (state: SafeBookStateView) => void;
  revealPendingStateId: Nullable<string>;
  states: SafeBookStateView[];
};

export function RelationshipHistory({
  canRevealDescription,
  onRevealDescription,
  revealPendingStateId,
  states,
}: RelationshipHistoryProps) {
  const t = useTranslations("relationships.details.history");

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">{t("heading")}</h3>
      {states.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {states.map((state) => (
            <RelationshipBookStateItem
              canRevealDescription={canRevealDescription}
              isRevealPending={revealPendingStateId === state.id}
              key={state.id}
              onRevealDescription={onRevealDescription}
              state={state}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function RelationshipBookStateItem({
  canRevealDescription,
  isRevealPending,
  onRevealDescription,
  state,
}: RelationshipBookStateItemProps) {
  const t = useTranslations("relationships.details.history");
  const labels = useRelationshipLabels();
  const introduced = labels.statePosition({ edge: "introduced", state });
  const ended = labels.statePosition({ edge: "ended", state });

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        {state.partNumber === null ? null : (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("part", { number: state.partNumber })}
          </span>
        )}
        <h4 className="min-w-0 text-sm font-semibold wrap-anywhere text-ink">{state.bookTitle}</h4>
      </div>

      {state.status === null && state.intensity === null ? null : (
        <ul className="flex flex-wrap gap-1.5">
          <RelationshipStateBadges state={state} />
        </ul>
      )}

      {introduced === null && ended === null ? null : (
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {introduced === null ? null : <p>{t("introduced", { position: introduced })}</p>}
          {ended === null ? null : <p>{t("ended", { position: ended })}</p>}
        </div>
      )}

      {state.description === null ? null : (
        <p className="text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground">
          {state.description}
        </p>
      )}

      {state.descriptionHidden ? (
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UiIcon className="shrink-0" name="eye-off" size={14} />
            {canRevealDescription ? t("descriptionHidden") : t("descriptionGlobal")}
          </p>
          {canRevealDescription ? (
            <RelationshipRevealButton
              isPending={isRevealPending}
              onReveal={() => onRevealDescription(state)}
            >
              {t("revealDescription")}
            </RelationshipRevealButton>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

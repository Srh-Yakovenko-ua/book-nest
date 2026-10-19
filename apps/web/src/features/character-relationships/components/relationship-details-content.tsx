"use client";

import type {
  CharacterRelationshipSafeDetailsView,
  Nullable,
  SafeBookStateView,
} from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/http-client";

import type { RelationshipActions } from "../model/relationship-adapter";
import type { RelationshipReveal, RelationshipRevealRequest } from "../model/relationship-reveal";
import type { RelationshipScope } from "../model/relationship-scope";

import { useRelationshipDetails } from "../api/use-relationship-details";
import { hasRelationshipActions } from "../model/relationship-adapter";
import {
  applyRelationshipRevealRequest,
  hasRelationshipReveal,
  RELATIONSHIP_NO_REVEAL,
} from "../model/relationship-reveal";
import {
  canRevealRelationshipDescription,
  toRelationshipFocusCharacterId,
} from "../model/relationship-scope";
import { RelationshipHistory } from "./relationship-history";
import { RelationshipParticipants } from "./relationship-participants";
import { RelationshipRevealConfirmDialog } from "./relationship-reveal-confirm-dialog";
import { RelationshipStateBadges } from "./relationship-state-badges";
import { RelationshipTypeSection } from "./relationship-type-section";
import { RelationshipsErrorState } from "./relationships-error-state";

const NOT_FOUND_STATUS = 404;

type RelationshipDetailsContentProps = {
  actions: RelationshipActions;
  relationshipId: string;
  scope: RelationshipScope;
};

type RevealConfirmation = {
  open: boolean;
  request: RelationshipRevealRequest;
};

export function RelationshipDetailsContent({
  actions,
  relationshipId,
  scope,
}: RelationshipDetailsContentProps) {
  const t = useTranslations("relationships.details");
  const [reveal, setReveal] = useState<RelationshipReveal>(RELATIONSHIP_NO_REVEAL);
  const [confirmation, setConfirmation] = useState<Nullable<RevealConfirmation>>(null);
  const isRevealing = hasRelationshipReveal(reveal);
  const base = useRelationshipDetails({ relationshipId, reveal: RELATIONSHIP_NO_REVEAL, scope });
  const revealed = useRelationshipDetails({ enabled: isRevealing, relationshipId, reveal, scope });

  if (base.isPending) return <RelationshipDetailsSkeleton label={t("loading")} />;
  if (base.isLoadingError) {
    if (isNotFound(base.error)) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
          <UiIcon className="text-muted-foreground" name="eye-off" size={24} />
          <p className="text-sm font-medium text-foreground">{t("notAvailable.title")}</p>
          <p className="text-xs text-muted-foreground">{t("notAvailable.description")}</p>
        </div>
      );
    }
    return (
      <RelationshipsErrorState
        description={t("error.description")}
        onRetry={() => void base.refetch()}
        retryLabel={t("error.retry")}
        title={t("error.title")}
      />
    );
  }

  const details = (isRevealing ? revealed.data : undefined) ?? base.data;
  const isRevealFetching = isRevealing && revealed.isFetching;
  const { onDelete, onEdit } = actions;

  function requestReveal(request: RelationshipRevealRequest) {
    setConfirmation({ open: true, request });
  }

  function confirmReveal(request: RelationshipRevealRequest) {
    setReveal((current) => applyRelationshipRevealRequest({ request, reveal: current }));
    setConfirmation((current) => (current === null ? null : { ...current, open: false }));
  }

  return (
    <>
      <div
        aria-label={t("title")}
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-md px-1 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        role="region"
        tabIndex={0}
      >
        <RelationshipParticipants
          edge={details.relationship}
          focusCharacterId={toRelationshipFocusCharacterId(scope)}
          size="dialog"
        />

        {isRevealing && revealed.isError ? (
          <div
            className="flex flex-col items-start gap-2 rounded-lg bg-error-soft p-3"
            role="alert"
          >
            <p className="text-sm text-error">
              {isNotFound(revealed.error) ? t("revealUnavailable") : t("revealError")}
            </p>
            {isNotFound(revealed.error) ? null : (
              <Button onClick={() => void revealed.refetch()} size="sm" variant="secondary">
                <UiIcon name="refresh" size={14} />
                {t("revealRetry")}
              </Button>
            )}
          </div>
        ) : null}

        <RelationshipTypeSection
          isRevealPending={isRevealFetching && reveal.isTypeRevealed}
          onReveal={() => requestReveal({ kind: "type" })}
          relationship={details.relationship}
        />

        {details.effectiveState === null ? null : (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-ink">{t("state")}</h3>
            <ul className="flex flex-wrap gap-1.5">
              <RelationshipStateBadges state={details.effectiveState} />
            </ul>
          </section>
        )}

        <RelationshipHistory
          canRevealDescription={canRevealRelationshipDescription(scope)}
          onRevealDescription={(state) =>
            requestReveal({
              bookStateId: state.id,
              bookTitle: state.bookTitle,
              kind: "description",
            })
          }
          revealPendingStateId={isRevealFetching ? reveal.descriptionBookStateId : null}
          states={toHistoryStates(details)}
        />
      </div>

      {hasRelationshipActions(actions) ? (
        <DialogFooter>
          {onEdit === undefined ? null : (
            <Button onClick={() => onEdit(relationshipId)} type="button" variant="secondary">
              <UiIcon name="edit" size={16} />
              {t("actions.edit")}
            </Button>
          )}
          {onDelete === undefined ? null : (
            <Button onClick={() => onDelete(relationshipId)} type="button" variant="destructive">
              <UiIcon name="trash" size={16} />
              {t("actions.delete")}
            </Button>
          )}
        </DialogFooter>
      ) : null}

      {confirmation === null ? null : (
        <RelationshipRevealConfirmDialog
          onCancel={() =>
            setConfirmation((current) => (current === null ? null : { ...current, open: false }))
          }
          onConfirm={confirmReveal}
          open={confirmation.open}
          request={confirmation.request}
        />
      )}
    </>
  );
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === NOT_FOUND_STATUS;
}

function RelationshipDetailsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy className="flex flex-col gap-4" role="status">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-2">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

function toHistoryStates(details: CharacterRelationshipSafeDetailsView): SafeBookStateView[] {
  if (details.history.length > 0) return details.history;
  return details.effectiveState === null ? [] : [details.effectiveState];
}

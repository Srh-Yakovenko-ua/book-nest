"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import type { RelationshipAction, RelationshipBookOption } from "../model/relationship-adapter";
import type { RelationshipScope } from "../model/relationship-scope";

import { useRelationshipList } from "../api/use-relationship-list";
import { isGlobalCharacterScope, toRelationshipScopeKey } from "../model/relationship-scope";
import { toRelationshipScrollScope } from "../model/relationship-scroll-anchor";
import { useRelationshipListQuery } from "../model/use-relationship-list-query";
import { useRelationshipScrollRestoration } from "../model/use-relationship-scroll-restoration";
import { RelationshipDetailsDialog } from "./relationship-details-dialog";
import { RelationshipListContent, toRelationshipListView } from "./relationship-list-content";
import { RelationshipListToolbar } from "./relationship-list-toolbar";

type DetailsTarget = {
  open: boolean;
  relationshipId: string;
};

type RelationshipListProps = {
  bookOptions?: readonly RelationshipBookOption[];
  onCreate?: () => void;
  onDelete?: RelationshipAction;
  onEdit?: RelationshipAction;
  scope: RelationshipScope;
};

export function RelationshipList({
  bookOptions,
  onCreate,
  onDelete,
  onEdit,
  scope,
}: RelationshipListProps) {
  const t = useTranslations("relationships.list");
  const query = useRelationshipListQuery(scope);
  const list = useRelationshipList({ criteria: query.criteria, scope });
  const [details, setDetails] = useState<Nullable<DetailsTarget>>(null);
  const resultsStartRef = useRef<HTMLDivElement>(null);

  const items = list.data?.items ?? [];
  const totalCount = list.data?.totalCount ?? items.length;
  const view = toRelationshipListView({
    hasActiveCriteria: query.hasActiveCriteria,
    items,
    list,
  });
  const actions = { onDelete, onEdit };

  const captureScrollPosition = useRelationshipScrollRestoration({
    containerRef: resultsStartRef,
    isFetching: list.isFetching,
    isResultsRendered: view === "results",
    renderedCount: items.length,
    scrollScope: toRelationshipScrollScope({
      criteria: query.criteria,
      scopeKey: toRelationshipScopeKey(scope),
    }),
  });

  function openDetails(relationshipId: string) {
    captureScrollPosition();
    setDetails({ open: true, relationshipId });
  }

  function closeDetails() {
    setDetails((current) => (current === null ? null : { ...current, open: false }));
  }

  function runFromDetails(action: RelationshipAction | undefined) {
    if (action === undefined) return undefined;
    return (relationshipId: string) => {
      closeDetails();
      action(relationshipId);
    };
  }

  return (
    <section
      className="flex scroll-mt-[calc(var(--shell-header-height)+1rem)] flex-col gap-4"
      ref={resultsStartRef}
    >
      <h2 className="sr-only">{t("heading")}</h2>
      {view === "emptyScope" ? null : (
        <RelationshipListToolbar
          bookOptions={isGlobalCharacterScope(scope) ? (bookOptions ?? null) : null}
          onCreate={onCreate}
          query={query}
        />
      )}
      <RelationshipListContent
        actions={actions}
        items={items}
        list={list}
        onClearCriteria={query.clearAll}
        onCreate={onCreate}
        onOpen={openDetails}
        scope={scope}
        totalCount={totalCount}
        view={view}
      />

      {details === null ? null : (
        <RelationshipDetailsDialog
          onClose={closeDetails}
          onDelete={runFromDetails(onDelete)}
          onEdit={runFromDetails(onEdit)}
          open={details.open}
          relationshipId={details.relationshipId}
          scope={scope}
        />
      )}
    </section>
  );
}

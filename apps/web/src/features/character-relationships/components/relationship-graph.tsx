"use client";

import type { Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { RelationshipAction } from "../model/relationship-adapter";
import type { RelationshipGraphCriteria } from "../model/relationship-graph-criteria";
import type {
  RelationshipGraphPathEndpoints,
  RelationshipGraphPathQuery,
} from "../model/relationship-graph-path";
import type { RelationshipGraphScope } from "../model/relationship-graph-scope";
import type { RelationshipGraphCanvasLayout } from "./relationship-graph-canvas-actions";

import { useRelationshipGraph } from "../api/use-relationship-graph";
import { useRelationshipGraphLayout } from "../api/use-relationship-graph-layout";
import { useRelationshipPath } from "../api/use-relationship-path";
import {
  clearRelationshipGraphFilters,
  hasRelationshipGraphFilters,
  RELATIONSHIP_GRAPH_CRITERIA,
} from "../model/relationship-graph-criteria";
import {
  RELATIONSHIP_GRAPH_PATH,
  toRelationshipGraphPathState,
  toVisibleRelationshipGraphEndpoints,
} from "../model/relationship-graph-path";
import {
  toRelationshipGraphContextBookId,
  toRelationshipGraphLayoutKey,
} from "../model/relationship-graph-scope";
import { RelationshipDetailsDialog } from "./relationship-details-dialog";
import { RelationshipGraphContent } from "./relationship-graph-content";
import { RelationshipGraphControls } from "./relationship-graph-controls";
import { RelationshipGraphLegend } from "./relationship-graph-legend";
import { RelationshipGraphNodePreview } from "./relationship-graph-node-preview";
import { RelationshipGraphNotices } from "./relationship-graph-notices";
import { RelationshipGraphPathControls } from "./relationship-graph-path-controls";

export type RelationshipGraphProps = {
  onDelete?: RelationshipAction;
  onEdit?: RelationshipAction;
  scope: RelationshipGraphScope;
};

type DetailsTarget = {
  open: boolean;
  relationshipId: string;
};

export function RelationshipGraph({ onDelete, onEdit, scope }: RelationshipGraphProps) {
  const t = useTranslations("relationships.graph");
  const locale = useLocale();
  const [criteria, setCriteria] = useState<RelationshipGraphCriteria>(
    RELATIONSHIP_GRAPH_CRITERIA.defaults,
  );
  const [endpoints, setEndpoints] = useState<RelationshipGraphPathEndpoints>(
    RELATIONSHIP_GRAPH_PATH.emptyEndpoints,
  );
  const [previewNodeId, setPreviewNodeId] = useState<Nullable<string>>(null);
  const [details, setDetails] = useState<Nullable<DetailsTarget>>(null);

  const graph = useRelationshipGraph({ criteria, scope });
  const layoutKey = toRelationshipGraphLayoutKey({ mode: criteria.mode, scope });
  const { layout, remove, save } = useRelationshipGraphLayout(layoutKey);

  const nodes = graph.data?.nodes ?? [];
  const collator = new Intl.Collator(locale);
  const characters = [...nodes].sort((left, right) => collator.compare(left.name, right.name));
  const visibleEndpoints = toVisibleRelationshipGraphEndpoints({
    endpoints,
    nodeIds: new Set(nodes.map((node) => node.id)),
  });
  const pathQuery: RelationshipGraphPathQuery = {
    contextBookId: toRelationshipGraphContextBookId(scope),
    filters: {
      categories: criteria.categories,
      mode: criteria.mode,
      relationshipTypes: criteria.relationshipTypes,
    },
    ...visibleEndpoints,
  };
  const path = useRelationshipPath(pathQuery);
  const pathState = toRelationshipGraphPathState({ path, query: pathQuery });
  const previewNode = nodes.find((node) => node.id === previewNodeId) ?? null;
  const hasFilters = hasRelationshipGraphFilters(criteria);

  const canvasLayout: RelationshipGraphCanvasLayout = {
    hasSavedLayout: (layout.data ?? null) !== null,
    isResetting: remove.isPending,
    isSaving: save.isPending,
    onReset: () => remove.mutate(undefined, { onError: () => toast.error(t("layout.resetError")) }),
    onSave: (snapshot) =>
      save.mutate(snapshot, {
        onError: () => toast.error(t("layout.saveError")),
        onSuccess: () => toast.success(t("layout.saved")),
      }),
  };

  function clearFilters() {
    setCriteria(clearRelationshipGraphFilters(criteria));
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
    <section className="flex flex-col gap-4">
      <h2 className="sr-only">{t("heading")}</h2>

      <RelationshipGraphControls
        characters={characters}
        criteria={criteria}
        onChange={setCriteria}
      />

      {graph.isFetching && graph.isPlaceholderData ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t("updating")}
        </p>
      ) : null}

      {graph.data === undefined ? null : (
        <>
          <RelationshipGraphNotices hiddenContent={graph.data.hiddenContent} />
          <RelationshipGraphLegend clusters={graph.data.clusters} />
        </>
      )}

      <RelationshipGraphContent
        canvas={{
          activeNodeId: previewNode?.id ?? null,
          focusCharacterId: criteria.focusCharacterId,
          layout: canvasLayout,
          onEdgeOpen: (relationshipId) => setDetails({ open: true, relationshipId }),
          onNodeOpen: setPreviewNodeId,
          path: pathState,
        }}
        canvasKey={JSON.stringify(layoutKey)}
        graph={graph}
        hasFilters={hasFilters}
        layout={layout}
        onClearFilters={clearFilters}
        preview={
          previewNode === null ? null : (
            <RelationshipGraphNodePreview
              key={previewNode.id}
              node={previewNode}
              onClose={() => setPreviewNodeId(null)}
              onFocus={() => {
                setCriteria({ ...criteria, focusCharacterId: previewNode.id });
                setPreviewNodeId(null);
              }}
              scope={scope}
            />
          )
        }
      />

      <RelationshipGraphPathControls
        characters={characters}
        endpoints={visibleEndpoints}
        onChange={setEndpoints}
        onRetry={() => void path.refetch()}
        state={pathState}
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

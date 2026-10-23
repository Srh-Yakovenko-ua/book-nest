"use client";

import type { CharacterGraphEdgeView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { GraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphCharacterConnectionItem } from "./graph-character-details";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { GraphCharacterDetails } from "./graph-character-details";
import { GraphConnectionDetails } from "./graph-connection-details";
import { GraphConnectionsList } from "./graph-connections-list";
import { GraphDetailsPanel } from "./graph-details-panel";
import { GraphSceneStatus } from "./graph-scene-status";
import { GraphWorkspaceCanvasLazy } from "./graph-workspace-canvas-lazy";
import { GraphWorkspaceMessage } from "./graph-workspace-message";
import { useGraphCounterText } from "./use-graph-counter-text";
import { useGraphEdgeLabel } from "./use-graph-edge-label";

type GraphSceneSectionProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  immersive: boolean;
  isError: boolean;
  isNotFound: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  onMoreClusters: () => void;
  onMoreHop: (hop: number) => void;
  onRestoreFocus: () => void;
  onRetry: () => void;
  onToggleImmersive: () => void;
  params: GraphWorkspaceParams;
  pendingOverwrite: boolean;
  placementKey: string;
  presentation: Nullable<GraphWorkspacePresentation>;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  restore: Nullable<GraphWorkspaceLayoutRestore>;
  sceneKey: string;
  sceneValue: Nullable<GraphSceneValue>;
  selection: GraphSceneSelection;
  widthClass: WorkspaceWidthClass;
};

type PanelContent =
  | null
  | {
      edges: CharacterGraphEdgeView[];
      id: string;
      kind: "connection";
      sourceId: string;
      targetId: string;
    }
  | { id: string; kind: "character" };

export function GraphSceneSection(props: GraphSceneSectionProps) {
  const t = useTranslations("relationships.workspace");
  const counterText = useGraphCounterText(props.presentation);
  const announcement = props.isError ? "" : (counterText ?? t("states.loading"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p
        aria-live="polite"
        className={cn("pb-2 text-sm text-muted-foreground", announcement === "" && "sr-only")}
      >
        {announcement}
      </p>
      <SceneContent {...props} />
    </div>
  );
}

function ReadyScene({
  actions,
  bookId,
  immersive,
  layout,
  layoutKey,
  onClearSelection,
  onConfirmOverwrite,
  onDismissOverwrite,
  onMoreClusters,
  onMoreHop,
  onRestoreFocus,
  onToggleImmersive,
  params,
  pendingOverwrite,
  placementKey,
  presentation,
  reader,
  relationshipActions,
  restore,
  sceneKey,
  sceneValue,
  selection,
  widthClass,
}: GraphSceneSectionProps & {
  presentation: GraphWorkspacePresentation;
  sceneValue: GraphSceneValue;
}) {
  const t = useTranslations("relationships.workspace");
  const toLabel = useGraphEdgeLabel();
  const edgeById = new Map(presentation.edges.map((edge) => [edge.id, edge] as const));
  const panel = toPanelContent({ edgeById, presentation, selection });
  const positions = new Map(presentation.positions);
  for (const [id, point] of restore?.positions ?? []) positions.set(id, point);

  return (
    <section className={cn("flex flex-col gap-3", immersive && "min-h-0 flex-1")}>
      <GraphSceneStatus
        empty={presentation.empty}
        notices={presentation.notices}
        onResetFilters={actions.resetFilters}
      />
      {presentation.moreHops.length > 0 || presentation.hasMoreClusters ? (
        <div className="flex flex-wrap gap-2">
          {presentation.moreHops.map((hop) => (
            <Button
              key={hop}
              onClick={() => onMoreHop(hop)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("more.ring", { hop })}
            </Button>
          ))}
          {presentation.hasMoreClusters ? (
            <Button onClick={onMoreClusters} size="sm" type="button" variant="outline">
              {t("more.clusters")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {pendingOverwrite ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm"
          role="alert"
        >
          <span>{t("canvas.overwrite")}</span>
          <Button onClick={onConfirmOverwrite} size="sm" type="button">
            {t("canvas.confirmOverwrite")}
          </Button>
          <Button onClick={onDismissOverwrite} size="sm" type="button" variant="ghost">
            {t("canvas.cancelOverwrite")}
          </Button>
        </div>
      ) : null}
      <div className={cn("flex gap-3", immersive ? "min-h-0 flex-1" : "h-128 sm:h-160")}>
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
          <GraphWorkspaceCanvasLazy
            aggregates={presentation.aggregates}
            connections={presentation.connections}
            controls={{
              immersive,
              layout,
              onToggleImmersive,
              position: widthClass === "medium" && panel !== null ? "top-left" : "top-right",
            }}
            layoutKey={layoutKey}
            onPaneClick={onClearSelection}
            placementKey={placementKey}
            positions={positions}
            sceneKey={sceneKey}
            value={sceneValue}
            viewport={restore?.viewport ?? null}
          />
          {widthClass === "medium" ? (
            <ScenePanel
              actions={actions}
              bookId={bookId}
              onClearSelection={onClearSelection}
              onRestoreFocus={onRestoreFocus}
              panel={panel}
              params={params}
              presentation={presentation}
              reader={reader}
              relationshipActions={relationshipActions}
              sceneValue={sceneValue}
              toLabel={toLabel}
              widthClass={widthClass}
            />
          ) : null}
        </div>
        {widthClass === "medium" ? null : (
          <ScenePanel
            actions={actions}
            bookId={bookId}
            onClearSelection={onClearSelection}
            onRestoreFocus={onRestoreFocus}
            panel={panel}
            params={params}
            presentation={presentation}
            reader={reader}
            relationshipActions={relationshipActions}
            sceneValue={sceneValue}
            toLabel={toLabel}
            widthClass={widthClass}
          />
        )}
      </div>
      <GraphConnectionsList
        aggregates={presentation.aggregates}
        characters={presentation.characters}
        clusters={presentation.clusters}
        connections={presentation.connections}
        onAggregateOpen={sceneValue.onAggregateOpen}
        onConnectionOpen={sceneValue.onConnectionOpen}
      />
    </section>
  );
}

function SceneContent(props: GraphSceneSectionProps) {
  const t = useTranslations("relationships.workspace");
  const { actions, isError, isNotFound, params, presentation, sceneValue } = props;

  if (isError) {
    return isNotFound && params.view !== "network" ? (
      <GraphWorkspaceMessage
        action={{ label: t("states.unavailableCharacter.action"), onClick: actions.clearCharacter }}
        description={t("states.unavailableCharacter.description")}
        title={t("states.unavailableCharacter.title")}
      />
    ) : (
      <GraphWorkspaceMessage
        action={{ label: t("states.error.retry"), onClick: props.onRetry }}
        description={t("states.error.description")}
        title={t("states.error.title")}
      />
    );
  }

  if (presentation === null || sceneValue === null) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <Skeleton className="h-128 w-full rounded-2xl" />
      </div>
    );
  }

  return <ReadyScene {...props} presentation={presentation} sceneValue={sceneValue} />;
}

function ScenePanel({
  actions,
  bookId,
  onClearSelection,
  onRestoreFocus,
  panel,
  params,
  presentation,
  reader,
  relationshipActions,
  sceneValue,
  toLabel,
  widthClass,
}: {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  onClearSelection: () => void;
  onRestoreFocus: () => void;
  panel: PanelContent;
  params: GraphWorkspaceParams;
  presentation: GraphWorkspacePresentation;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  sceneValue: GraphSceneValue;
  toLabel: (edge: CharacterGraphEdgeView) => string;
  widthClass: WorkspaceWidthClass;
}) {
  const t = useTranslations("relationships.workspace");
  const nameOf = (id: string) => presentation.characters.get(id)?.node.displayName ?? "";
  const character = panel?.kind === "character" ? presentation.characters.get(panel.id) : undefined;
  const title =
    panel?.kind === "connection"
      ? t("panel.connection.title", {
          source: nameOf(panel.sourceId),
          target: nameOf(panel.targetId),
        })
      : (character?.node.displayName ?? t("panel.title"));

  return (
    <GraphDetailsPanel
      onClose={onClearSelection}
      onRestoreFocus={onRestoreFocus}
      open={panel !== null}
      title={title}
      widthClass={widthClass}
    >
      {character === undefined ? null : (
        <GraphCharacterDetails
          bookId={bookId}
          branch={
            character.canExpand || character.canCollapse
              ? {
                  expanded: character.canCollapse,
                  onToggle: () => sceneValue.onBranchToggle(character.node.id),
                }
              : null
          }
          connections={presentation.connections
            .filter(
              (connection) =>
                connection.sourceId === character.node.id ||
                connection.targetId === character.node.id,
            )
            .map((connection): GraphCharacterConnectionItem => {
              const otherId =
                connection.sourceId === character.node.id
                  ? connection.targetId
                  : connection.sourceId;
              const [firstEdgeId] = connection.edgeIds;
              const firstEdge = presentation.edges.find((edge) => edge.id === firstEdgeId);
              return {
                connectionId: connection.id,
                label:
                  connection.edgeIds.length > 1 || firstEdge === undefined
                    ? t("connection.many")
                    : toLabel(firstEdge),
                otherName: nameOf(otherId),
              };
            })}
          isRoot={character.isRoot}
          node={character.node}
          onExplore={null}
          onFindPath={() => actions.openPath(character.node.id)}
          onMakeCenter={
            character.isRoot && params.view !== "network"
              ? null
              : () => actions.makeCenter(character.node.id)
          }
          onOpenConnection={sceneValue.onConnectionOpen}
        />
      )}
      {panel?.kind === "connection" ? (
        <GraphConnectionDetails
          actions={relationshipActions}
          contentKey={JSON.stringify([bookId, reader, panel.id])}
          edges={panel.edges}
          key={panel.id}
          names={{ source: nameOf(panel.sourceId), target: nameOf(panel.targetId) }}
          scope={{ bookId, kind: "book" }}
        />
      ) : null}
    </GraphDetailsPanel>
  );
}

function toPanelContent({
  edgeById,
  presentation,
  selection,
}: {
  edgeById: ReadonlyMap<string, CharacterGraphEdgeView>;
  presentation: GraphWorkspacePresentation;
  selection: GraphSceneSelection;
}): PanelContent {
  if (selection === null) return null;
  if (selection.kind === "character") return { id: selection.id, kind: "character" };
  const connection = presentation.connections.find((entry) => entry.id === selection.id);
  if (connection === undefined) return null;
  return {
    edges: connection.edgeIds.flatMap((id) => {
      const edge = edgeById.get(id);
      return edge === undefined ? [] : [edge];
    }),
    id: connection.id,
    kind: "connection",
    sourceId: connection.sourceId,
    targetId: connection.targetId,
  };
}

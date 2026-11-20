"use client";

import type { CharacterGraphEdgeView, Nullable } from "@app/shared";

import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type {
  GraphPairEntry,
  GraphPairSemantics,
} from "../../model/workspace/graph-person-semantics";
import type { GraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import {
  toGraphCharacterReach,
  toGraphPairEntries,
  toGraphPairSemanticsById,
  toGraphPersonLabelPairIds,
} from "../../model/workspace/graph-person-semantics";
import { withRestoredPositions } from "../../model/workspace/graph-workspace-signature";
import { GraphConnectionDetails } from "./graph-connection-details";
import { GraphDetailsPanel } from "./graph-details-panel";
import { GraphPersonCharacterDetails } from "./graph-person-character-details";
import { GraphPersonConnectionsList } from "./graph-person-connections-list";
import { GraphPersonEdgeRow } from "./graph-person-edge-row";
import { GraphPersonLegend } from "./graph-person-legend";
import { GraphPersonPairHeader } from "./graph-person-pair-header";
import { GraphSceneNotices } from "./graph-scene-notices";
import { GraphWorkspaceCanvasLazy } from "./graph-workspace-canvas-lazy";

const PERSON_SCENE = {
  nearestLimit: 5,
  partialNotices: ["overBudget", "truncated"],
} as const;

export type GraphPersonPanelState = {
  isOpen: boolean;
  onClose: () => void;
};

type GraphPersonSceneProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  immersive: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  onMoreClusters: () => void;
  onMoreHop: (hop: number) => void;
  onRestoreFocus: () => void;
  onToggleImmersive: () => void;
  params: GraphWorkspaceParams;
  pendingOverwrite: boolean;
  personPanel: GraphPersonPanelState;
  placementKey: string;
  presentation: GraphWorkspacePresentation;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  restore: Nullable<GraphWorkspaceLayoutRestore>;
  rootId: string;
  sceneKey: string;
  sceneValue: GraphSceneValue;
  selection: GraphSceneSelection;
  widthClass: WorkspaceWidthClass;
};

type PersonPanelTarget =
  null | { connectionId: string; kind: "connection" } | { id: string; kind: "character" };

export function GraphPersonScene(props: GraphPersonSceneProps) {
  const {
    actions,
    immersive,
    layout,
    layoutKey,
    onClearSelection,
    onToggleImmersive,
    params,
    personPanel,
    placementKey,
    presentation,
    restore,
    rootId,
    sceneKey,
    sceneValue,
    selection,
    widthClass,
  } = props;
  const listId = useId();
  const prefersReducedMotion = useReducedMotion();
  const semantics = toGraphPairSemanticsById({
    connections: presentation.connections,
    edges: presentation.edges,
  });
  const nameOf = (id: string) => presentation.characters.get(id)?.node.displayName ?? "";
  const entries = toGraphPairEntries({ connections: presentation.connections, nameOf, rootId });
  const target = toPanelTarget({ isOpen: personPanel.isOpen, rootId, selection });

  function showAllConnections() {
    const list = document.getElementById(listId);
    list?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    list?.querySelector("input")?.focus({ preventScroll: true });
  }

  const panel = (
    <PersonPanel
      {...props}
      entries={entries}
      nameOf={nameOf}
      onShowAllConnections={widthClass === "compact" ? null : showAllConnections}
      semantics={semantics}
      target={target}
    />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <GraphSceneNotices
        onConfirmOverwrite={props.onConfirmOverwrite}
        onDismissOverwrite={props.onDismissOverwrite}
        onMoreClusters={props.onMoreClusters}
        onMoreHop={props.onMoreHop}
        onResetFilters={actions.resetFilters}
        pendingOverwrite={props.pendingOverwrite}
        presentation={presentation}
      />
      <div className="flex gap-3">
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
            widthClass === "compact" ? "graph-person-canvas-compact" : "graph-person-canvas",
          )}
        >
          <div className="relative min-h-0 flex-1 bg-radial from-card from-35% to-secondary/70">
            <GraphWorkspaceCanvasLazy
              aggregates={presentation.aggregates}
              connections={presentation.connections}
              controls={{
                immersive,
                layout,
                onToggleImmersive,
                position: toControlsPosition({ hasPanel: target !== null, widthClass }),
                rootId,
              }}
              layoutKey={layoutKey}
              onPaneClick={onClearSelection}
              person={{
                labelPairIds: toGraphPersonLabelPairIds({
                  connections: presentation.connections,
                  rootId,
                  semantics,
                }),
                rootId,
                semantics,
              }}
              placementKey={placementKey}
              positions={withRestoredPositions({ positions: presentation.positions, restore })}
              sceneKey={sceneKey}
              value={sceneValue}
              viewport={restore?.viewport ?? null}
            />
          </div>
          <GraphPersonLegend
            activeCategories={params.categories}
            collapsible={widthClass === "compact"}
          />
          {widthClass === "medium" ? panel : null}
        </div>
        {widthClass === "compact" ? panel : null}
        {widthClass === "wide" && target !== null ? (
          <div className="relative w-88 shrink-0">{panel}</div>
        ) : null}
      </div>
      <GraphPersonConnectionsList
        characters={presentation.characters}
        entries={entries}
        id={listId}
        key={rootId}
        onConnectionOpen={sceneValue.onConnectionOpen}
        relationships={presentation.edges.length}
        selectedId={selection?.kind === "connection" ? selection.id : null}
        semantics={semantics}
        widthClass={widthClass}
      />
    </section>
  );
}

function CharacterPanelContent({
  actions,
  bookId,
  characterId,
  entries,
  onShowAllConnections,
  presentation,
  sceneValue,
  semantics,
}: {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  characterId: string;
  entries: readonly GraphPairEntry[];
  onShowAllConnections: Nullable<() => void>;
  presentation: GraphWorkspacePresentation;
  sceneValue: GraphSceneValue;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
}) {
  const character = presentation.characters.get(characterId);
  if (character === undefined) return null;
  const own = entries.filter(
    (entry) => entry.firstId === characterId || entry.secondId === characterId,
  );
  const nearest = own.flatMap((entry) => {
    const otherId = entry.firstId === characterId ? entry.secondId : entry.firstId;
    const other = presentation.characters.get(otherId)?.node;
    const pair = semantics.get(entry.connection.id);
    return other === undefined || pair === undefined
      ? []
      : [{ connectionId: entry.connection.id, other, semantics: pair }];
  });

  return (
    <GraphPersonCharacterDetails
      bookId={bookId}
      branch={
        character.canExpand || character.canCollapse
          ? {
              expanded: character.canCollapse,
              onToggle: () => sceneValue.onBranchToggle(characterId),
            }
          : null
      }
      isPartial={
        presentation.moreHops.length > 0 ||
        presentation.notices.some((notice) =>
          PERSON_SCENE.partialNotices.some((partial) => partial === notice),
        )
      }
      isRoot={character.isRoot}
      mapCharacters={character.isRoot ? presentation.characters.size : null}
      mapPairs={entries.length}
      nearest={nearest.slice(0, PERSON_SCENE.nearestLimit)}
      node={character.node}
      onFindPath={() => actions.openPath(characterId)}
      onMakeCenter={character.isRoot ? null : () => actions.makeCenter(characterId)}
      onOpenConnection={sceneValue.onConnectionOpen}
      onShowAllConnections={onShowAllConnections}
      reach={toGraphCharacterReach({ characterId, connections: presentation.connections })}
    />
  );
}

function PairPanelContent({
  bookId,
  entry,
  nameOf,
  presentation,
  reader,
  relationshipActions,
  semantics,
}: {
  bookId: string;
  entry: GraphPairEntry;
  nameOf: (id: string) => string;
  presentation: GraphWorkspacePresentation;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
}) {
  const first = presentation.characters.get(entry.firstId)?.node;
  const second = presentation.characters.get(entry.secondId)?.node;
  const pair = semantics.get(entry.connection.id);
  if (first === undefined || second === undefined || pair === undefined) return null;
  const edgeById = new Map(presentation.edges.map((edge) => [edge.id, edge] as const));
  const edges = entry.connection.edgeIds.flatMap((id): CharacterGraphEdgeView[] => {
    const edge = edgeById.get(id);
    return edge === undefined ? [] : [edge];
  });

  return (
    <>
      <GraphPersonPairHeader first={first} nameOf={nameOf} second={second} semantics={pair} />
      <div className="flex shrink-0 flex-col gap-4">
        <GraphConnectionDetails
          actions={relationshipActions}
          contentKey={JSON.stringify([bookId, reader, entry.connection.id])}
          edges={edges}
          key={entry.connection.id}
          names={{ source: first.displayName, target: second.displayName }}
          renderEdge={(edge, index) => (
            <GraphPersonEdgeRow edge={edge} index={index} nameOf={nameOf} />
          )}
          scope={{ bookId, kind: "book" }}
        />
      </div>
    </>
  );
}

function PersonPanel({
  actions,
  bookId,
  entries,
  nameOf,
  onRestoreFocus,
  onShowAllConnections,
  personPanel,
  presentation,
  reader,
  relationshipActions,
  sceneValue,
  selection,
  semantics,
  target,
  widthClass,
}: GraphPersonSceneProps & {
  entries: readonly GraphPairEntry[];
  nameOf: (id: string) => string;
  onShowAllConnections: Nullable<() => void>;
  semantics: ReadonlyMap<string, GraphPairSemantics>;
  target: PersonPanelTarget;
}) {
  const t = useTranslations("relationships.workspace");
  const character =
    target?.kind === "character" ? presentation.characters.get(target.id) : undefined;
  const pairEntry =
    target?.kind === "connection"
      ? entries.find((entry) => entry.connection.id === target.connectionId)
      : undefined;
  const title =
    pairEntry === undefined
      ? (character?.node.displayName ?? t("panel.title"))
      : t("panel.connection.title", {
          source: nameOf(pairEntry.firstId),
          target: nameOf(pairEntry.secondId),
        });

  return (
    <GraphDetailsPanel
      appearance="person"
      autoFocus={selection !== null}
      onClose={personPanel.onClose}
      onRestoreFocus={onRestoreFocus}
      open={character !== undefined || pairEntry !== undefined}
      title={title}
      widthClass={widthClass}
    >
      {character === undefined ? null : (
        <CharacterPanelContent
          actions={actions}
          bookId={bookId}
          characterId={character.node.id}
          entries={entries}
          onShowAllConnections={onShowAllConnections}
          presentation={presentation}
          sceneValue={sceneValue}
          semantics={semantics}
        />
      )}
      {pairEntry === undefined ? null : (
        <PairPanelContent
          bookId={bookId}
          entry={pairEntry}
          nameOf={nameOf}
          presentation={presentation}
          reader={reader}
          relationshipActions={relationshipActions}
          semantics={semantics}
        />
      )}
    </GraphDetailsPanel>
  );
}

function toControlsPosition({
  hasPanel,
  widthClass,
}: {
  hasPanel: boolean;
  widthClass: WorkspaceWidthClass;
}): "bottom-center" | "top-left" | "top-right" {
  if (widthClass === "compact") return "bottom-center";
  return widthClass === "medium" && hasPanel ? "top-left" : "top-right";
}

function toPanelTarget({
  isOpen,
  rootId,
  selection,
}: {
  isOpen: boolean;
  rootId: string;
  selection: GraphSceneSelection;
}): PersonPanelTarget {
  if (selection?.kind === "connection") return { connectionId: selection.id, kind: "connection" };
  if (selection?.kind === "character") return { id: selection.id, kind: "character" };
  return isOpen ? { id: rootId, kind: "character" } : null;
}

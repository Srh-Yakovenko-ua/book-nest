"use client";

import type { CharacterGraphViewport, Nullable } from "@app/shared";

import { useState } from "react";

import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { NetworkBucket } from "../../model/workspace/graph-network-index";
import type {
  GraphNetworkPresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphNetworkNotice, GraphNetworkNoticeKind } from "./graph-network-notices";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphGenealogyFocusRequest } from "./graph-tree-scene-context";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { withRestoredPositions } from "../../model/workspace/graph-workspace-signature";
import { GraphConnectionsList } from "./graph-connections-list";
import { GraphNetworkFocusBar } from "./graph-network-focus-bar";
import { GraphNetworkLegend } from "./graph-network-legend";
import { GraphNetworkNotices } from "./graph-network-notices";
import { GraphNetworkPanel } from "./graph-network-panel";
import { toGraphNetworkPanelTarget } from "./graph-network-panel-target";
import { toNetworkEmphasis, toNetworkSelectionIds } from "./graph-network-selection";
import { GraphWorkspaceCanvasLazy } from "./graph-workspace-canvas-lazy";
import { useCanvasFitHeight } from "./use-canvas-fit-height";
import { GRAPH_PERSON_CONTROLS_COVER } from "./use-graph-person-camera";
import { useNetworkBucketLabel } from "./use-network-bucket-label";

const NETWORK_SCENE = {
  canvas: {
    compact: "graph-person-canvas-compact",
    immersive: "graph-person-canvas-immersive",
    regular: "graph-person-canvas",
  },
  overlayCover: 392,
} as const;

export type GraphNetworkNavigation = {
  cameraKey: string;
  canUseGroupGrouping: boolean;
  focusRequest: Nullable<GraphGenealogyFocusRequest>;
  notices: readonly GraphNetworkNotice[];
  onDismissNotice: (kind: GraphNetworkNoticeKind) => void;
  onExplore: (target: { aggregateId: string; bucketId: string }) => void;
  onFocusGroup: (bucketId: Nullable<string>) => void;
  onMoreClusters: () => void;
  onMoreMembers: () => void;
  onOpenMembers: () => void;
  onPickCharacter: (characterId: string) => void;
  onRequestFocus: (ids: readonly string[]) => void;
  onResetBlocked: () => void;
  onResetFilters: () => void;
  onUseGroupGrouping: () => void;
};

type GraphNetworkSceneProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  immersive: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  network: GraphNetworkPresentation;
  networkNav: GraphNetworkNavigation;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  onRestoreFocus: () => void;
  onToggleImmersive: () => void;
  pendingOverwrite: boolean;
  placementKey: string;
  presentation: GraphWorkspacePresentation;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  restore: Nullable<GraphWorkspaceLayoutRestore>;
  sceneKey: string;
  sceneValue: GraphSceneValue;
  selection: GraphSceneSelection;
  widthClass: WorkspaceWidthClass;
};

export function GraphNetworkScene({
  actions,
  bookId,
  immersive,
  layout,
  layoutKey,
  network,
  networkNav,
  onClearSelection,
  onConfirmOverwrite,
  onDismissOverwrite,
  onRestoreFocus,
  onToggleImmersive,
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
}: GraphNetworkSceneProps) {
  const toBucketLabel = useNetworkBucketLabel();
  const [isMiniMapOpen, setMiniMapOpen] = useState(true);
  const [cameras, setCameras] = useState<Readonly<Record<string, CharacterGraphViewport>>>({});
  const { index, scene } = network;
  const labelOf = (bucket: NetworkBucket) => toBucketLabel(bucket.label);
  const { cameraKey } = networkNav;
  const aggregates = new Map(scene.links.map((link) => [link.id, link] as const));
  const linkById = new Map([
    ...index.bucketLinks.map((link) => [link.id, link] as const),
    ...aggregates,
  ]);
  const target = toGraphNetworkPanelTarget({ index, labelOf, linkById, selection });
  const isCompact = widthClass === "compact";
  const hasCanvas = presentation.empty === null;
  const fitRef = useCanvasFitHeight(hasCanvas && (immersive || !isCompact));
  const controlsPosition = toControlsPosition({ hasPanel: target !== null, widthClass });
  const isOverlayOpen = widthClass === "medium" && target !== null;
  const focusIds = toNetworkSelectionIds({ aggregates, sceneValue, selection });
  const controlsCover = GRAPH_PERSON_CONTROLS_COVER[controlsPosition];

  const panel = (
    <GraphNetworkPanel
      bookId={bookId}
      hasSelection={selection !== null}
      index={index}
      isCharacterOnMap={(characterId) => sceneValue.characters.has(characterId)}
      isConnectionOnMap={(connectionId) => sceneValue.connections.has(connectionId)}
      labelOf={labelOf}
      onClose={onClearSelection}
      onExplore={networkNav.onExplore}
      onExploreAround={actions.makeCenter}
      onFindPath={actions.openPath}
      onFocusOnMap={(characterId) => networkNav.onRequestFocus([characterId])}
      onOpenConnection={sceneValue.onConnectionOpen}
      onPickCharacter={networkNav.onPickCharacter}
      onRestoreFocus={onRestoreFocus}
      reader={reader}
      relationshipActions={relationshipActions}
      target={target}
      widthClass={widthClass}
    />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <GraphNetworkNotices
        canUseGroupGrouping={networkNav.canUseGroupGrouping}
        notices={networkNav.notices}
        onConfirmOverwrite={onConfirmOverwrite}
        onDismiss={networkNav.onDismissNotice}
        onDismissOverwrite={onDismissOverwrite}
        onResetBlocked={networkNav.onResetBlocked}
        onResetFilters={networkNav.onResetFilters}
        onUseGroupGrouping={networkNav.onUseGroupGrouping}
        pendingOverwrite={pendingOverwrite}
        presentation={presentation}
      />
      {hasCanvas ? (
        <>
          <GraphNetworkFocusBar
            grouping={index.effectiveGrouping}
            onFocusGroup={networkNav.onFocusGroup}
            onMoreClusters={networkNav.onMoreClusters}
            onMoreMembers={networkNav.onMoreMembers}
            onOpenMembers={networkNav.onOpenMembers}
            scene={scene}
          />
          <div className="flex gap-3">
            <div
              className={cn(
                "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
                NETWORK_SCENE.canvas[toCanvasSize({ immersive, isCompact })],
              )}
              ref={fitRef}
            >
              <div className="relative min-h-0 flex-1 bg-radial from-card from-35% to-secondary/70">
                <GraphWorkspaceCanvasLazy
                  aggregates={presentation.aggregates}
                  connections={presentation.connections}
                  controls={{
                    immersive,
                    layout,
                    onToggleImmersive,
                    position: controlsPosition,
                    rootId: null,
                  }}
                  layoutKey={layoutKey}
                  network={{
                    aggregates,
                    cover: {
                      ...controlsCover,
                      right: isOverlayOpen ? NETWORK_SCENE.overlayCover : controlsCover.right,
                    },
                    emphasis: toNetworkEmphasis({ aggregates, presentation, scene, selection }),
                    focusRequest: networkNav.focusRequest,
                    index,
                    miniMap:
                      isCompact || isOverlayOpen
                        ? null
                        : {
                            isOpen: isMiniMapOpen,
                            onToggle: () => setMiniMapOpen((current) => !current),
                          },
                    onCameraChange: (viewport) =>
                      setCameras((current) => ({ ...current, [cameraKey]: viewport })),
                    onFocusSelected:
                      focusIds.length === 0 ? null : () => networkNav.onRequestFocus(focusIds),
                  }}
                  onPaneClick={onClearSelection}
                  person={null}
                  placementKey={placementKey}
                  positions={withRestoredPositions({ positions: presentation.positions, restore })}
                  sceneKey={sceneKey}
                  value={sceneValue}
                  viewport={cameras[cameraKey] ?? restore?.viewport ?? null}
                />
                {widthClass === "medium" ? panel : null}
              </div>
              <GraphNetworkLegend />
            </div>
            {isCompact ? panel : null}
            {widthClass === "wide" && target !== null ? (
              <div className="relative w-90 shrink-0">{panel}</div>
            ) : null}
          </div>
          <GraphConnectionsList
            aggregates={presentation.aggregates}
            characters={presentation.characters}
            clusters={presentation.clusters}
            connections={presentation.connections}
            onAggregateOpen={sceneValue.onAggregateOpen}
            onConnectionOpen={sceneValue.onConnectionOpen}
          />
        </>
      ) : null}
    </section>
  );
}

function toCanvasSize({
  immersive,
  isCompact,
}: {
  immersive: boolean;
  isCompact: boolean;
}): keyof typeof NETWORK_SCENE.canvas {
  if (isCompact) return "compact";
  return immersive ? "immersive" : "regular";
}

function toControlsPosition({
  hasPanel,
  widthClass,
}: {
  hasPanel: boolean;
  widthClass: WorkspaceWidthClass;
}): GraphPersonControlsPosition {
  if (widthClass === "compact") return "bottom-center";
  return widthClass === "medium" && hasPanel ? "top-left" : "top-right";
}

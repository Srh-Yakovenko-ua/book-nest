"use client";

import type { Nullable } from "@app/shared";

import { Crown, Route, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphTreePresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphTreeCanvasScene } from "./graph-tree-scene-context";
import type { GraphHiddenSelection } from "./graph-tree-status";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { toGraphPairEntries } from "../../model/workspace/graph-person-semantics";
import { toTreeRelatives } from "../../model/workspace/graph-tree-relatives";
import { withRestoredPositions } from "../../model/workspace/graph-workspace-signature";
import { GraphDetailsPanel } from "./graph-details-panel";
import { GraphTreeCharacterDetails } from "./graph-tree-character-details";
import { GraphTreeConnectionsList } from "./graph-tree-connections-list";
import { GraphTreeLegend } from "./graph-tree-legend";
import { withGraphTreeMiniMapCover } from "./graph-tree-mini-map";
import { GraphTreePairDetails } from "./graph-tree-pair-details";
import { GraphTreeStatus } from "./graph-tree-status";
import { GraphWorkspaceCanvasLazy } from "./graph-workspace-canvas-lazy";
import { useCanvasFitHeight } from "./use-canvas-fit-height";
import { GRAPH_PERSON_CONTROLS_COVER } from "./use-graph-person-camera";
import { useIsShortViewport } from "./use-is-short-viewport";

const TREE_SCENE_VIEW = {
  canvas: {
    compact: "graph-person-canvas-compact",
    immersive: "graph-person-canvas-immersive",
    regular: "graph-person-canvas",
  },
  miniMapFrom: 24,
  overlayCover: 392,
} as const;

export type GraphTreePanelState = {
  isOpen: boolean;
  onClose: () => void;
};

type GraphTreeSceneProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  hiddenSelection: Nullable<GraphHiddenSelection>;
  immersive: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissHiddenSelection: () => void;
  onDismissOverwrite: () => void;
  onRestoreFocus: () => void;
  onRevealCharacter: (characterId: string) => void;
  onToggleImmersive: () => void;
  pendingOverwrite: boolean;
  placementKey: string;
  presentation: GraphWorkspacePresentation;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  restore: Nullable<GraphWorkspaceLayoutRestore>;
  rootId: string;
  sceneKey: string;
  sceneValue: GraphSceneValue;
  selection: GraphSceneSelection;
  tree: GraphTreePresentation;
  treeOptions: TreeOptions;
  treePanel: GraphTreePanelState;
  widthClass: WorkspaceWidthClass;
};

type TreePanelTarget =
  null | { connectionId: string; kind: "connection" } | { id: string; kind: "character" };

export function GraphTreeScene(props: GraphTreeSceneProps) {
  const {
    immersive,
    layout,
    layoutKey,
    onClearSelection,
    onToggleImmersive,
    placementKey,
    presentation,
    restore,
    rootId,
    sceneKey,
    sceneValue,
    selection,
    tree,
    treeOptions,
    treePanel,
    widthClass,
  } = props;
  const t = useTranslations("relationships.workspace");
  const listId = useId();
  const isShort = useIsShortViewport();
  const [isMiniMapOpen, setMiniMapOpen] = useState(true);
  const panelFocus = useRef<Nullable<string>>(null);
  const nameOf = (id: string) => presentation.characters.get(id)?.node.displayName ?? "";
  const entries = toGraphPairEntries({ connections: presentation.connections, nameOf, rootId });
  const target = toPanelTarget({ isOpen: treePanel.isOpen, rootId, selection });
  const hasTarget = target !== null;
  useEffect(() => {
    if (!hasTarget) panelFocus.current = null;
  }, [hasTarget]);
  const isCompact = widthClass === "compact";
  const fitRef = useCanvasFitHeight(immersive || !isCompact);
  const controlsPosition = toControlsPosition({ hasPanel: target !== null, widthClass });
  const isOverlayOpen = widthClass === "medium" && target !== null;
  const hasMiniMap =
    !isCompact && !isOverlayOpen && presentation.characters.size >= TREE_SCENE_VIEW.miniMapFrom;
  const baseCover = {
    ...GRAPH_PERSON_CONTROLS_COVER[controlsPosition],
    right: isOverlayOpen
      ? TREE_SCENE_VIEW.overlayCover
      : GRAPH_PERSON_CONTROLS_COVER[controlsPosition].right,
  };
  const canvasTree: GraphTreeCanvasScene = {
    arcPairIds: tree.arcPairIds,
    cover: hasMiniMap && isMiniMapOpen ? withGraphTreeMiniMapCover(baseCover) : baseCover,
    focusIds: toFocusIds({ rootId, tree }),
    genealogy: null,
    generationById: tree.scene.generationById,
    miniMap: hasMiniMap
      ? { isOpen: isMiniMapOpen, onToggle: () => setMiniMapOpen((current) => !current) }
      : null,
    pairs: tree.pairs,
    rootId,
    rows: tree.rows,
    sideIds: new Set(tree.scene.sideAnchorById.keys()),
  };
  const panel = (
    <TreePanel {...props} focusMemoryRef={panelFocus} nameOf={nameOf} target={target} />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <GraphTreeStatus
        collapsed={null}
        hiddenSelection={props.hiddenSelection}
        immersive={immersive}
        notices={presentation.notices}
        onConfirmOverwrite={props.onConfirmOverwrite}
        onDismissHiddenSelection={props.onDismissHiddenSelection}
        onDismissOverwrite={props.onDismissOverwrite}
        onResetLinks={props.actions.resetTreeLinks}
        onRevealSelection={props.onRevealCharacter}
        pendingOverwrite={props.pendingOverwrite}
      />
      <div className="flex gap-3">
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
            TREE_SCENE_VIEW.canvas[toCanvasSize({ immersive, isCompact })],
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
                rootId,
              }}
              layoutKey={layoutKey}
              onPaneClick={onClearSelection}
              person={null}
              placementKey={placementKey}
              positions={withRestoredPositions({ positions: presentation.positions, restore })}
              sceneKey={sceneKey}
              tree={canvasTree}
              value={sceneValue}
              viewport={restore?.viewport ?? null}
            />
            <div
              className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center"
              role="status"
            >
              {presentation.empty === "treeRootOnly" || presentation.empty === "treeFiltered" ? (
                <div className="max-w-md rounded-2xl border border-border bg-card/95 px-4 py-3 text-center shadow-soft backdrop-blur-sm">
                  <p className="font-heading text-base font-semibold text-ink">
                    {t(`states.${presentation.empty}.title`)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`states.${presentation.empty}.description`)}
                  </p>
                </div>
              ) : null}
            </div>
            {widthClass === "medium" ? panel : null}
          </div>
          {immersive && isShort ? null : <GraphTreeLegend options={treeOptions} />}
        </div>
        {widthClass === "compact" ? panel : null}
        {widthClass === "wide" && target !== null ? (
          <div className="relative w-90 shrink-0">{panel}</div>
        ) : null}
      </div>
      <GraphTreeConnectionsList
        characters={presentation.characters}
        entries={entries}
        id={listId}
        key={rootId}
        onConnectionOpen={sceneValue.onConnectionOpen}
        pairs={tree.pairs}
        relationships={presentation.edges.length}
        selectedId={selection?.kind === "connection" ? selection.id : null}
        widthClass={widthClass}
      />
    </section>
  );
}

function CharacterActions({
  actions,
  bookId,
  characterId,
  isRoot,
}: {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  characterId: string;
  isRoot: boolean;
}) {
  const t = useTranslations("relationships.workspace.tree.panel");

  return (
    <>
      {isRoot ? null : (
        <Button className="w-full" onClick={() => actions.makeCenter(characterId)} type="button">
          <Crown aria-hidden />
          {t("makeCenter")}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          onClick={() => actions.openPath(characterId)}
          type="button"
          variant={isRoot ? "default" : "outline"}
        >
          <Route aria-hidden />
          {t("findPath")}
        </Button>
        <Button asChild className="w-full" variant="outline">
          <Link href={getCharacterDetailsPath({ bookId, characterId })}>
            <UserRound aria-hidden />
            {t("profile")}
          </Link>
        </Button>
      </div>
    </>
  );
}

function toCanvasSize({
  immersive,
  isCompact,
}: {
  immersive: boolean;
  isCompact: boolean;
}): keyof typeof TREE_SCENE_VIEW.canvas {
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

function toFocusIds({
  rootId,
  tree,
}: {
  rootId: string;
  tree: GraphTreePresentation;
}): ReadonlySet<string> {
  const ids = new Set([rootId]);
  for (const link of tree.scene.lineage) {
    if (link.childId === rootId) ids.add(link.parentId);
    if (link.parentId === rootId) ids.add(link.childId);
  }
  for (const [sideId, anchorId] of tree.scene.sideAnchorById) {
    if (anchorId === rootId) ids.add(sideId);
  }
  return ids;
}

function toPanelTarget({
  isOpen,
  rootId,
  selection,
}: {
  isOpen: boolean;
  rootId: string;
  selection: GraphSceneSelection;
}): TreePanelTarget {
  if (selection?.kind === "connection") return { connectionId: selection.id, kind: "connection" };
  if (selection?.kind === "character") return { id: selection.id, kind: "character" };
  return isOpen ? { id: rootId, kind: "character" } : null;
}

function toTargetKey(target: TreePanelTarget): string {
  if (target === null) return "";
  return target.kind === "connection"
    ? `connection:${target.connectionId}`
    : `character:${target.id}`;
}

function TreePanel({
  actions,
  bookId,
  focusMemoryRef,
  nameOf,
  onRestoreFocus,
  presentation,
  reader,
  relationshipActions,
  sceneValue,
  selection,
  target,
  tree,
  treePanel,
  widthClass,
}: GraphTreeSceneProps & {
  focusMemoryRef: RefObject<Nullable<string>>;
  nameOf: (id: string) => string;
  target: TreePanelTarget;
}) {
  const t = useTranslations("relationships.workspace");
  const character =
    target?.kind === "character" ? presentation.characters.get(target.id) : undefined;
  const pair = target?.kind === "connection" ? tree.pairs.get(target.connectionId) : undefined;
  const connection =
    target?.kind === "connection"
      ? presentation.connections.find((entry) => entry.id === target.connectionId)
      : undefined;
  const first =
    connection === undefined ? undefined : presentation.characters.get(connection.sourceId)?.node;
  const second =
    connection === undefined ? undefined : presentation.characters.get(connection.targetId)?.node;
  const isPair = pair !== undefined && first !== undefined && second !== undefined;
  const title =
    isPair && connection !== undefined
      ? t("panel.connection.title", {
          source: nameOf(connection.sourceId),
          target: nameOf(connection.targetId),
        })
      : (character?.node.displayName ?? t("panel.title"));
  const anchorId =
    character === undefined ? undefined : tree.scene.sideAnchorById.get(character.node.id);

  return (
    <GraphDetailsPanel
      appearance="person"
      autoFocus={selection !== null}
      focusKey={toTargetKey(target)}
      focusMemoryRef={focusMemoryRef}
      footer={
        character === undefined ? undefined : (
          <CharacterActions
            actions={actions}
            bookId={bookId}
            characterId={character.node.id}
            isRoot={character.isRoot}
          />
        )
      }
      heading={t(`tree.panel.heading.${isPair ? "connection" : "character"}`)}
      onClose={treePanel.onClose}
      onRestoreFocus={onRestoreFocus}
      open={character !== undefined || isPair}
      title={title}
      widthClass={widthClass}
    >
      {character === undefined ? null : (
        <GraphTreeCharacterDetails
          anchorName={anchorId === undefined ? null : nameOf(anchorId)}
          generation={tree.scene.generationById.get(character.node.id) ?? null}
          isRoot={character.isRoot}
          key={character.node.id}
          node={character.node}
          nodeOf={(id) => presentation.characters.get(id)?.node}
          onOpenConnection={sceneValue.onConnectionOpen}
          relatives={toTreeRelatives({
            characterId: character.node.id,
            connections: presentation.connections,
            nameOf,
            pairs: tree.pairs,
          })}
          treeCharacters={presentation.characters.size}
        />
      )}
      {isPair ? (
        <GraphTreePairDetails
          actions={relationshipActions}
          bookId={bookId}
          first={first}
          pair={pair}
          reader={reader}
          second={second}
        />
      ) : null}
    </GraphDetailsPanel>
  );
}

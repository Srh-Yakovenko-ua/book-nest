"use client";

import type { Nullable } from "@app/shared";

import { ChevronsDownUp, ChevronsUpDown, Network, Route, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { type RefObject, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getCharacterDetailsPath } from "@/features/characters";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphGenealogyPresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphGenealogyNavigation } from "./graph-scene-section";
import type { GraphTreePanelState } from "./graph-tree-scene";
import type { GraphTreeCanvasScene } from "./graph-tree-scene-context";
import type { GraphHiddenSelection } from "./graph-tree-status";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { toGraphPairEntries } from "../../model/workspace/graph-person-semantics";
import { toTreeRelatives } from "../../model/workspace/graph-tree-relatives";
import { withRestoredPositions } from "../../model/workspace/graph-workspace-signature";
import { GraphDetailsPanel } from "./graph-details-panel";
import {
  toGenealogyBranchMembers,
  toGenealogyFamilyLabel,
  toGenealogyHouseMarks,
} from "./graph-genealogy-branches";
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

const GENEALOGY_SCENE_VIEW = {
  canvas: {
    compact: "graph-person-canvas-compact",
    immersive: "graph-person-canvas-immersive",
    regular: "graph-person-canvas",
  },
  landmarkCover: 56,
  landmarks: 4,
  overlayCover: 392,
} as const;

type GenealogyPanelTarget =
  null | { connectionId: string; kind: "connection" } | { id: string; kind: "character" };

type GraphGenealogySceneProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  focusId: Nullable<string>;
  genealogy: GraphGenealogyPresentation;
  genealogyNav: GraphGenealogyNavigation;
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
  onToggleBranch: (characterId: string) => void;
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
  treeOptions: TreeOptions;
  treePanel: GraphTreePanelState;
  widthClass: WorkspaceWidthClass;
};

export function GraphGenealogyScene(props: GraphGenealogySceneProps) {
  const {
    focusId,
    genealogy,
    genealogyNav,
    immersive,
    layout,
    layoutKey,
    onClearSelection,
    onToggleImmersive,
    placementKey,
    presentation,
    restore,
    sceneKey,
    sceneValue,
    selection,
    treeOptions,
    treePanel,
    widthClass,
  } = props;
  const t = useTranslations("relationships.workspace");
  const listId = useId();
  const isShort = useIsShortViewport();
  const [isMiniMapOpen, setMiniMapOpen] = useState(true);
  const panelFocus = useRef<Nullable<string>>(null);
  const { scene } = genealogy;
  const liveFocusId = focusId !== null && presentation.characters.has(focusId) ? focusId : null;
  const nameOf = (id: string) => presentation.characters.get(id)?.node.displayName ?? "";
  const houseMarks = toGenealogyHouseMarks(genealogy);
  const activeBranch =
    genealogyNav.branches.find((branch) => branch.id === genealogyNav.activeBranchId) ?? null;
  const highlightIds =
    activeBranch === null
      ? null
      : new Set(toGenealogyBranchMembers({ branchId: activeBranch.id, genealogy }));
  const target = toPanelTarget({ focusId: liveFocusId, isOpen: treePanel.isOpen, selection });
  const hasTarget = target !== null;
  useEffect(() => {
    if (!hasTarget) panelFocus.current = null;
  }, [hasTarget]);
  const isCompact = widthClass === "compact";
  const fitRef = useCanvasFitHeight(immersive || !isCompact);
  const isOverlayOpen = widthClass === "medium" && target !== null;
  const hasMiniMap = !isCompact && !isOverlayOpen && presentation.characters.size > 1;
  const controlsPosition = toControlsPosition({ hasPanel: target !== null, widthClass });
  const baseCover = {
    ...GRAPH_PERSON_CONTROLS_COVER[controlsPosition],
    right: isOverlayOpen
      ? GENEALOGY_SCENE_VIEW.overlayCover
      : GRAPH_PERSON_CONTROLS_COVER[controlsPosition].right,
    top: isCompact ? 0 : GENEALOGY_SCENE_VIEW.landmarkCover,
  };
  const selectedId = selection?.kind === "character" ? selection.id : null;

  const canvasTree: GraphTreeCanvasScene = {
    arcPairIds: genealogy.arcPairIds,
    cover: hasMiniMap && isMiniMapOpen ? withGraphTreeMiniMapCover(baseCover) : baseCover,
    focusIds: new Set(liveFocusId === null ? [] : [liveFocusId]),
    genealogy: {
      activeBranch,
      collapsedIds: scene.collapsedIds,
      focusRequest: genealogyNav.focusRequest,
      frames: genealogy.frames.map((frame) => ({
        componentId: frame.componentId,
        label: toGenealogyFamilyLabel({
          componentId: frame.componentId,
          genealogy,
          houseMarks,
          nameOf,
          t,
        }),
        left: frame.left,
        top: frame.top,
      })),
      hiddenDescendantsById: scene.hiddenDescendantsById,
      highlightIds,
      houseById: new Map(
        [...scene.houseIdById].flatMap(([id, houseId]) => {
          const mark = houseMarks.get(houseId);
          return mark === undefined ? [] : [[id, mark] as const];
        }),
      ),
      landmarks: isCompact
        ? []
        : genealogyNav.branches
            .filter((branch) => branch.kind === "house")
            .sort((left, right) => right.count - left.count)
            .slice(0, GENEALOGY_SCENE_VIEW.landmarks),
      onBranch: genealogyNav.onBranch,
      onClearBranch: genealogyNav.onClearBranch,
      onExpand: props.onToggleBranch,
    },
    generationById: scene.generationById,
    miniMap: hasMiniMap
      ? { isOpen: isMiniMapOpen, onToggle: () => setMiniMapOpen((current) => !current) }
      : null,
    pairs: genealogy.pairs,
    rootId: liveFocusId,
    rows: genealogy.rows,
    sideIds: new Set(scene.sideAnchorById.keys()),
  };
  const panel = (
    <GenealogyPanel
      {...props}
      focusMemoryRef={panelFocus}
      nameOf={nameOf}
      onToggle={props.onToggleBranch}
      target={target}
    />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2">
      <GraphTreeStatus
        collapsed={
          scene.collapsedIds.size === 0
            ? null
            : { branches: scene.collapsedIds.size, hidden: scene.hiddenCount }
        }
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
            GENEALOGY_SCENE_VIEW.canvas[toCanvasSize({ immersive, isCompact })],
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
                rootId: selectedId ?? liveFocusId,
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
              {presentation.empty === "genealogyEmpty" ||
              presentation.empty === "genealogyFiltered" ? (
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
        entries={toGraphPairEntries({
          connections: presentation.connections,
          nameOf,
          rootId: null,
        })}
        id={listId}
        onConnectionOpen={sceneValue.onConnectionOpen}
        pairs={genealogy.pairs}
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
  descendants,
  hidden,
  isCollapsed,
  onToggle,
}: {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  characterId: string;
  descendants: number;
  hidden: number;
  isCollapsed: boolean;
  onToggle: (characterId: string) => void;
}) {
  const t = useTranslations("relationships.workspace.genealogy.panel");

  return (
    <>
      <Button className="w-full" onClick={() => actions.makeCenter(characterId)} type="button">
        <Network aria-hidden />
        {t("showBranch")}
      </Button>
      {descendants === 0 ? null : (
        <Button
          className="w-full"
          onClick={() => onToggle(characterId)}
          type="button"
          variant="outline"
        >
          {isCollapsed ? <ChevronsUpDown aria-hidden /> : <ChevronsDownUp aria-hidden />}
          {isCollapsed ? t("expand", { count: hidden }) : t("collapse")}
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="w-full"
          onClick={() => actions.openPath(characterId)}
          type="button"
          variant="outline"
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

function GenealogyPanel({
  actions,
  bookId,
  focusMemoryRef,
  genealogy,
  nameOf,
  onRestoreFocus,
  onToggle,
  presentation,
  reader,
  relationshipActions,
  sceneValue,
  selection,
  target,
  treePanel,
  widthClass,
}: GraphGenealogySceneProps & {
  focusMemoryRef: RefObject<Nullable<string>>;
  nameOf: (id: string) => string;
  onToggle: (characterId: string) => void;
  target: GenealogyPanelTarget;
}) {
  const t = useTranslations("relationships.workspace");
  const { scene } = genealogy;
  const character =
    target?.kind === "character" ? presentation.characters.get(target.id) : undefined;
  const pair = target?.kind === "connection" ? genealogy.pairs.get(target.connectionId) : undefined;
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
  const characterId = character?.node.id;
  const anchorId = characterId === undefined ? undefined : scene.sideAnchorById.get(characterId);

  return (
    <GraphDetailsPanel
      appearance="person"
      autoFocus={selection !== null}
      focusKey={toTargetKey(target)}
      focusMemoryRef={focusMemoryRef}
      footer={
        characterId === undefined ? undefined : (
          <CharacterActions
            actions={actions}
            bookId={bookId}
            characterId={characterId}
            descendants={scene.childCountById.get(characterId) ?? 0}
            hidden={scene.hiddenDescendantsById.get(characterId) ?? 0}
            isCollapsed={scene.collapsedIds.has(characterId)}
            onToggle={onToggle}
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
          generation={scene.generationById.get(character.node.id) ?? null}
          isRoot={false}
          key={character.node.id}
          node={character.node}
          nodeOf={(id) => presentation.characters.get(id)?.node}
          onOpenConnection={sceneValue.onConnectionOpen}
          ordinal
          relatives={toTreeRelatives({
            characterId: character.node.id,
            connections: presentation.connections,
            nameOf,
            pairs: genealogy.pairs,
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

function toCanvasSize({
  immersive,
  isCompact,
}: {
  immersive: boolean;
  isCompact: boolean;
}): keyof typeof GENEALOGY_SCENE_VIEW.canvas {
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

function toPanelTarget({
  focusId,
  isOpen,
  selection,
}: {
  focusId: Nullable<string>;
  isOpen: boolean;
  selection: GraphSceneSelection;
}): GenealogyPanelTarget {
  if (selection?.kind === "connection") return { connectionId: selection.id, kind: "connection" };
  if (selection?.kind === "character") return { id: selection.id, kind: "character" };
  return isOpen && focusId !== null ? { id: focusId, kind: "character" } : null;
}

function toTargetKey(target: GenealogyPanelTarget): string {
  if (target === null) return "";
  return target.kind === "connection"
    ? `connection:${target.connectionId}`
    : `character:${target.id}`;
}

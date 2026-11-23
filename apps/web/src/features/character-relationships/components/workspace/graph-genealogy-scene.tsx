"use client";

import type { Nullable } from "@app/shared";

import { ChevronsDownUp, ChevronsUpDown, Network, Route, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

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
import type { GraphGenealogyBranch } from "./graph-genealogy-bar";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphTreePanelState } from "./graph-tree-scene";
import type {
  GraphGenealogyFocusRequest,
  GraphGenealogyHouseMark,
  GraphTreeCanvasScene,
} from "./graph-tree-scene-context";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { toGraphPairEntries } from "../../model/workspace/graph-person-semantics";
import { toTreeRelatives } from "../../model/workspace/graph-tree-relatives";
import { withRestoredPositions } from "../../model/workspace/graph-workspace-signature";
import { GraphDetailsPanel } from "./graph-details-panel";
import { GraphGenealogyBar } from "./graph-genealogy-bar";
import { GraphTreeCharacterDetails } from "./graph-tree-character-details";
import { GraphTreeConnectionsList } from "./graph-tree-connections-list";
import { GraphTreeLegend } from "./graph-tree-legend";
import { withGraphTreeMiniMapCover } from "./graph-tree-mini-map";
import { GraphTreePairDetails } from "./graph-tree-pair-details";
import { GraphTreeStatus } from "./graph-tree-status";
import { GraphWorkspaceCanvasLazy } from "./graph-workspace-canvas-lazy";
import { GRAPH_PERSON_CONTROLS_COVER } from "./use-graph-person-camera";

const GENEALOGY_SCENE_VIEW = {
  canvas: {
    compact: "graph-person-canvas-compact",
    immersive: "graph-person-canvas-immersive",
    regular: "graph-person-canvas",
  },
  overlayCover: 392,
} as const;

type GenealogyPanelTarget =
  null | { connectionId: string; kind: "connection" } | { id: string; kind: "character" };

type GraphGenealogySceneProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  focusId: Nullable<string>;
  genealogy: GraphGenealogyPresentation;
  immersive: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  onExpandAll: () => void;
  onRestoreFocus: () => void;
  onReveal: (characterId: string) => void;
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
  const [isMiniMapOpen, setMiniMapOpen] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<Nullable<string>>(null);
  const [focusRequest, setFocusRequest] = useState<Nullable<GraphGenealogyFocusRequest>>(null);
  const { scene } = genealogy;
  const liveFocusId = focusId !== null && presentation.characters.has(focusId) ? focusId : null;
  const nameOf = (id: string) => presentation.characters.get(id)?.node.displayName ?? "";
  const houseMarks = toHouseMarks(genealogy);
  const branches = toBranches({ genealogy, houseMarks, nameOf, t });
  const activeBranch = branches.find((branch) => branch.id === activeBranchId) ?? null;
  const highlightIds =
    activeBranch === null
      ? null
      : new Set(toBranchMembers({ branchId: activeBranch.id, genealogy }));
  const target = toPanelTarget({ focusId: liveFocusId, isOpen: treePanel.isOpen, selection });
  const isCompact = widthClass === "compact";
  const isOverlayOpen = widthClass === "medium" && target !== null;
  const hasMiniMap = !isCompact && !isOverlayOpen && presentation.characters.size > 1;
  const controlsPosition = toControlsPosition({ hasPanel: target !== null, widthClass });
  const baseCover = {
    ...GRAPH_PERSON_CONTROLS_COVER[controlsPosition],
    right: isOverlayOpen
      ? GENEALOGY_SCENE_VIEW.overlayCover
      : GRAPH_PERSON_CONTROLS_COVER[controlsPosition].right,
  };
  const selectedId = selection?.kind === "character" ? selection.id : null;

  function requestFocus(ids: readonly string[]) {
    if (ids.length === 0) return;
    setFocusRequest((current) => ({ ids, nonce: (current?.nonce ?? 0) + 1 }));
  }

  function toggleBranch(characterId: string) {
    props.onToggleBranch(characterId);
    requestFocus([characterId]);
  }

  const canvasTree: GraphTreeCanvasScene = {
    arcPairIds: genealogy.arcPairIds,
    cover: hasMiniMap && isMiniMapOpen ? withGraphTreeMiniMapCover(baseCover) : baseCover,
    focusIds: new Set(liveFocusId === null ? [] : [liveFocusId]),
    genealogy: {
      collapsedIds: scene.collapsedIds,
      focusRequest,
      frames: genealogy.frames.map((frame) => ({
        componentId: frame.componentId,
        label: toFamilyLabel({ componentId: frame.componentId, genealogy, houseMarks, nameOf, t }),
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
      onExpand: toggleBranch,
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
    <GenealogyPanel {...props} nameOf={nameOf} onToggle={toggleBranch} target={target} />
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <GraphTreeStatus
        notices={presentation.notices}
        onConfirmOverwrite={props.onConfirmOverwrite}
        onDismissOverwrite={props.onDismissOverwrite}
        pendingOverwrite={props.pendingOverwrite}
      />
      <GraphGenealogyBar
        activeBranchId={activeBranch?.id ?? null}
        branches={branches}
        characters={genealogy.allNodes}
        hiddenCount={scene.hiddenCount}
        onBranch={(branchId) => {
          setActiveBranchId(branchId);
          if (branchId !== null) {
            requestFocus(toBranchMembers({ branchId, genealogy }));
          }
        }}
        onExpandAll={props.onExpandAll}
        onFind={(characterId) => {
          setActiveBranchId(null);
          props.onReveal(characterId);
          requestFocus([characterId]);
        }}
      />
      <div className="flex gap-3">
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft",
            GENEALOGY_SCENE_VIEW.canvas[toCanvasSize({ immersive, isCompact })],
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
          <GraphTreeLegend options={treeOptions} />
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

function toBranches({
  genealogy,
  houseMarks,
  nameOf,
  t,
}: {
  genealogy: GraphGenealogyPresentation;
  houseMarks: ReadonlyMap<string, GraphGenealogyHouseMark>;
  nameOf: (id: string) => string;
  t: ReturnType<typeof useTranslations<"relationships.workspace">>;
}): GraphGenealogyBranch[] {
  const houses = genealogy.scene.houses.flatMap((house): GraphGenealogyBranch[] => {
    const mark = houseMarks.get(house.id);
    if (mark === undefined || house.memberIds.length === 0) return [];
    return [
      {
        count: house.memberIds.length,
        id: house.id,
        kind: "house",
        label: mark.name,
        tone: mark.tone,
      },
    ];
  });
  const families =
    genealogy.scene.components.length < 2
      ? []
      : genealogy.scene.components.map((component): GraphGenealogyBranch => ({
          count: component.memberIds.length,
          id: component.id,
          kind: "family",
          label: toFamilyLabel({ componentId: component.id, genealogy, houseMarks, nameOf, t }),
          tone:
            component.houseId === null ? null : (houseMarks.get(component.houseId)?.tone ?? null),
        }));
  return [...houses, ...families];
}

function toBranchMembers({
  branchId,
  genealogy,
}: {
  branchId: string;
  genealogy: GraphGenealogyPresentation;
}): readonly string[] {
  const house = genealogy.scene.houses.find((entry) => entry.id === branchId);
  if (house !== undefined) return house.memberIds;
  return genealogy.scene.components.find((entry) => entry.id === branchId)?.memberIds ?? [];
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

function toFamilyLabel({
  componentId,
  genealogy,
  houseMarks,
  nameOf,
  t,
}: {
  componentId: string;
  genealogy: GraphGenealogyPresentation;
  houseMarks: ReadonlyMap<string, GraphGenealogyHouseMark>;
  nameOf: (id: string) => string;
  t: ReturnType<typeof useTranslations<"relationships.workspace">>;
}): string {
  const component = genealogy.scene.components.find((entry) => entry.id === componentId);
  if (component === undefined) return "";
  const house = component.houseId === null ? undefined : houseMarks.get(component.houseId);
  return house === undefined
    ? t("genealogy.family", { count: component.memberIds.length, name: nameOf(component.titleId) })
    : t("genealogy.familyHouse", { count: component.memberIds.length, name: house.name });
}

function toHouseMarks(
  genealogy: GraphGenealogyPresentation,
): ReadonlyMap<string, GraphGenealogyHouseMark> {
  const ranked = [...genealogy.scene.houses].sort(
    (left, right) => right.size - left.size || left.id.localeCompare(right.id),
  );
  return new Map(
    ranked.flatMap((house, index) =>
      house.name === null ? [] : [[house.id, { name: house.name, tone: index }] as const],
    ),
  );
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

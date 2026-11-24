"use client";

import type { BookDetailsView, CharacterGraphViewport, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { RelationshipGraphLayoutKey } from "../../model/relationship-graph-scope";
import type { RelationshipScope } from "../../model/relationship-scope";
import type { GenealogyExpansion } from "../../model/workspace/graph-genealogy-scene";
import type { PersonExpansion } from "../../model/workspace/graph-person-scene";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";
import type {
  GraphWorkspaceParams,
  GraphWorkspaceView,
} from "../../model/workspace/graph-workspace-params";
import type {
  GraphNetworkPresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphGenealogyFocusRequest } from "./graph-tree-scene-context";
import type { GraphHiddenSelection } from "./graph-tree-status";
import type { GraphToolbarGenealogy } from "./graph-workspace-toolbar";

import {
  isGraphWorkspaceNotFound,
  useGraphWorkspaceScene,
} from "../../api/use-graph-workspace-queries";
import { useRelationshipGraphLayout } from "../../api/use-relationship-graph-layout";
import { GENEALOGY_LAYOUT } from "../../model/workspace/graph-genealogy-layout";
import {
  revealGenealogyCharacter,
  toggleGenealogyBranch,
} from "../../model/workspace/graph-genealogy-navigation";
import { EMPTY_GENEALOGY_EXPANSION } from "../../model/workspace/graph-genealogy-scene";
import { NETWORK_LAYOUT } from "../../model/workspace/graph-network-layout";
import {
  EMPTY_PERSON_EXPANSION,
  withPersonBranch,
  withPersonMore,
} from "../../model/workspace/graph-person-scene";
import { TREE_LAYOUT } from "../../model/workspace/graph-tree-layout";
import { TREE_SCENE } from "../../model/workspace/graph-tree-scene";
import { PERSON_LAYOUT } from "../../model/workspace/graph-workspace-layout";
import { GRAPH_WORKSPACE_VIEWS, toTreeOptions } from "../../model/workspace/graph-workspace-params";
import { buildGraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import {
  type GraphWorkspaceSceneData,
  toGraphReaderKey,
  toGraphWorkspaceSceneRequest,
} from "../../model/workspace/graph-workspace-request";
import {
  toGraphLayoutVersion,
  toGraphSceneKey,
  toRestoredGraphLayout,
  toSavedGraphPositions,
} from "../../model/workspace/graph-workspace-signature";
import { useGraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import { useRelationshipAuthoring } from "../use-relationship-authoring";
import { GraphActiveFilters } from "./graph-active-filters";
import {
  toGenealogyBranches,
  toGenealogyBranchMembers,
  toGenealogyHiddenIds,
  toGenealogyHouseMarks,
} from "./graph-genealogy-branches";
import { GraphGuidedStart } from "./graph-guided-start";
import { isNetworkSelectionLive } from "./graph-network-selection";
import { GraphPathExplorer } from "./graph-path-explorer";
import { GraphSceneSection } from "./graph-scene-section";
import { GraphWorkspaceHeader } from "./graph-workspace-header";
import { GraphTreeScopeSwitch, GraphWorkspaceToolbar } from "./graph-workspace-toolbar";
import { useGraphCounterText } from "./use-graph-counter-text";
import {
  toNetworkFocusBucketId,
  toNetworkSceneKeys,
  useGraphNetworkLocal,
  useGraphNetworkWorkspace,
} from "./use-graph-network-workspace";
import { useWorkspaceWidthClass } from "./use-workspace-width-class";

type CreateLocalStateInput = {
  identityKey: string;
  rootId: Nullable<string>;
  selection: GraphSceneSelection;
  view: GraphWorkspaceView;
};

type GraphWorkspaceShellProps = {
  book: BookDetailsView;
};

type LayoutSnapshot = {
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  viewport: CharacterGraphViewport;
};

type PanelIntent = "auto" | "closed" | "open";

type PersonPanelIntent = {
  intent: PanelIntent;
  rootId: Nullable<string>;
};

type WorkspaceLocalState = {
  branchId: Nullable<string>;
  cameraRestored: boolean;
  cameraSettled: boolean;
  focusRequest: Nullable<GraphGenealogyFocusRequest>;
  genealogy: GenealogyExpansion;
  identityKey: string;
  pendingOverwrite: Nullable<LayoutSnapshot>;
  person: PersonExpansion;
  relayout: number;
  rootId: Nullable<string>;
  selection: GraphSceneSelection;
  view: GraphWorkspaceView;
};

export function GraphWorkspaceShell({ book }: GraphWorkspaceShellProps) {
  const t = useTranslations("relationships.workspace");
  const bookId = book.id;
  const { actions: urlActions, params } = useGraphWorkspaceState();
  const reader = toGraphReaderKey(book);
  const sceneRequest = toGraphWorkspaceSceneRequest(params);
  const scene = useGraphWorkspaceScene({ bookId, reader, request: sceneRequest });
  const {
    element: container,
    personWidthClass,
    ref: containerRef,
    widthClass,
  } = useWorkspaceWidthClass();
  const [immersive, setImmersive] = useState(false);
  const lastTrigger = useRef<Nullable<HTMLElement>>(null);
  const focusNonce = useRef(0);
  const focusSceneStatus = useRef(false);
  const statusId = useId();
  const filtersTriggerId = useId();
  const branchesTriggerId = useId();
  const scope: RelationshipScope = { bookId, kind: "book" };
  const authoring = useRelationshipAuthoring({
    bookOptions: [{ id: bookId, title: book.title }],
    scope,
  });

  const identityKey = toGraphSceneKey([bookId, reader, sceneRequest, params.networkGroup]);
  const isPersonScene = params.view === "person" && !params.path;
  const isTreeScene = params.view === "tree" && !params.path;
  const isGenealogyScene = isTreeScene && params.treeScope === "full";
  const isPanelScene = isPersonScene || isTreeScene;
  const isNetworkScene = params.view === "network" && !params.path;
  const usesStatusFallback = isPanelScene || isNetworkScene;
  const hasActiveFilters = params.categories.length > 0 || params.types.length > 0;
  const treeOptions = isTreeScene ? toTreeOptions(params.treeLinks) : TREE_SCENE.defaultOptions;
  const [local, setLocal] = useState<WorkspaceLocalState>(() =>
    createLocalState({
      identityKey,
      rootId: params.characterId,
      selection: null,
      view: params.view,
    }),
  );
  const carriesNetwork = isNetworkScene && local.view === "network";
  const networkLocal = useGraphNetworkLocal({
    carriesNetwork,
    identityKey,
    networkFocus: params.networkFocus,
    selection: local.selection,
  });
  if (local.identityKey !== identityKey) {
    const keepsTreeSelection = isTreeScene && local.rootId === params.characterId;
    setLocal(
      createLocalState({
        identityKey,
        rootId: params.characterId,
        selection: carriesNetwork || keepsTreeSelection ? local.selection : null,
        view: params.view,
      }),
    );
  }
  const actions = {
    ...urlActions,
    chooseCharacter: (characterId: string) => {
      focusSceneStatus.current = true;
      urlActions.chooseCharacter(characterId);
    },
    closePath: () => {
      focusSceneStatus.current = true;
      urlActions.closePath();
    },
    exploreFromPath: (characterId: string) => {
      focusSceneStatus.current = true;
      urlActions.exploreFromPath(characterId);
    },
    makeCenter: (characterId: string) => {
      focusSceneStatus.current = true;
      urlActions.makeCenter(characterId);
    },
    setTreeScope: (scope: Parameters<typeof urlActions.setTreeScope>[0]) => {
      const selected = local.selection?.kind === "character" ? local.selection.id : null;
      urlActions.setTreeScope({
        characterId:
          scope.treeScope === "branch" ? (selected ?? scope.characterId) : scope.characterId,
        treeScope: scope.treeScope,
      });
    },
  };
  const sceneWidthClass = usesStatusFallback ? personWidthClass : widthClass;
  const [personPanel, setPersonPanel] = useState<PersonPanelIntent>(() => ({
    intent: "auto",
    rootId: params.characterId,
  }));
  if (personPanel.rootId !== params.characterId) {
    setPersonPanel({ intent: "auto", rootId: params.characterId });
  }
  const isPersonPanelOpen =
    personPanel.intent === "open" || (personPanel.intent === "auto" && sceneWidthClass === "wide");

  const presentation =
    scene.data === undefined || params.path
      ? null
      : buildGraphWorkspacePresentation({
          data: scene.data,
          genealogy: local.genealogy,
          network: networkLocal.state.expansion,
          networkFocus: params.networkFocus,
          params,
          person: local.person,
          treeOptions,
        });

  const isSceneMode = !params.path && (sceneRequest !== null || params.view === "network");
  const isUnavailable =
    isGraphWorkspaceNotFound(scene.error) ||
    (scene.isSuccess && presentation === null && !params.path);
  const isSceneError = (scene.isError && scene.data === undefined) || isUnavailable;
  const isStatusInline = isPanelScene && sceneRequest !== null;
  const counterText = useGraphCounterText(presentation);
  const network = isNetworkScene ? (presentation?.network ?? null) : null;
  const networkFocusBucketId = toNetworkFocusBucketId(network);

  const storageKey: RelationshipGraphLayoutKey = {
    contextBookId: null,
    mode: isGenealogyScene ? "genealogy" : params.view,
    scopeId: bookId,
    scopeType: "book",
  };
  const savedLayout = useRelationshipGraphLayout(storageKey, { enabled: presentation !== null });
  const allowedIds = new Set(presentation?.positions.keys() ?? []);
  const layoutVersion = toGraphLayoutVersion({
    bookId,
    nodeIds: presentation?.genealogy?.allNodes.map((node) => node.id) ?? [...allowedIds],
    reader,
    sceneKey: toGraphSceneKey(
      toLayoutSceneParts({ identityKey, networkFocusBucketId, params, treeOptions }),
    ),
  });
  const restore = toRestoredGraphLayout({
    allowedIds,
    layout: savedLayout.layout.data ?? null,
    layoutVersion,
  });

  const selection = reconcileSelection({ network, presentation, selection: local.selection });
  const isSceneReady = presentation !== null;
  if (isPersonScene && isSceneReady && !local.cameraSettled && savedLayout.layout.isFetched) {
    setLocal((current) => ({
      ...current,
      cameraRestored: restore !== null,
      cameraSettled: true,
    }));
  }

  useEffect(() => {
    if (!isSceneReady || !focusSceneStatus.current) return;
    focusSceneStatus.current = false;
    document.getElementById(statusId)?.focus();
  }, [isSceneReady, identityKey, statusId]);
  const hasSelection = selection !== null;
  const hasPersonPanel = isPanelScene && isSceneReady && isPersonPanelOpen;

  useEffect(() => {
    if (!hasSelection && !hasPersonPanel && !immersive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]') !== null) return;
      if (hasSelection || hasPersonPanel) {
        setLocal((current) => ({ ...current, selection: null }));
        if (isPanelScene) setPersonPanel((current) => ({ ...current, intent: "closed" }));
        focusTrigger(
          toRestoreTarget({
            fallbackId: statusId,
            trigger: hasSelection ? lastTrigger.current : null,
            useFallback: usesStatusFallback,
          }),
        );
        return;
      }
      setImmersive(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasPersonPanel, hasSelection, immersive, isPanelScene, statusId, usesStatusFallback]);

  useEffect(() => {
    if (!immersive || container === null) return;
    return makeSurroundingsInert(container);
  }, [container, immersive]);

  function select(next: GraphSceneSelection) {
    if (next === null) {
      changeSelection(() => null);
      return;
    }
    openSelection({
      selection: next,
      trigger: local.selection === null ? document.activeElement : null,
    });
  }

  function openSelection({
    selection: next,
    trigger,
  }: {
    selection: NonNullable<GraphSceneSelection>;
    trigger: Nullable<Element>;
  }) {
    if (trigger instanceof HTMLElement) lastTrigger.current = trigger;
    changeSelection(() => next);
    if (isPanelScene) setPersonPanel((current) => ({ ...current, intent: "open" }));
  }

  function changeSelection(change: (current: GraphSceneSelection) => GraphSceneSelection) {
    setLocal((current) => ({ ...current, selection: change(current.selection) }));
  }

  function nextFocusNonce() {
    focusNonce.current += 1;
    return focusNonce.current;
  }

  function setFocusRequest(request: GraphGenealogyFocusRequest) {
    setLocal((current) => ({ ...current, focusRequest: request }));
  }

  function requestCameraFocus(ids: readonly string[]) {
    if (ids.length === 0) return;
    setFocusRequest({ ids, nonce: nextFocusNonce() });
  }

  function revealCharacter(characterId: string) {
    setLocal((current) => ({
      ...current,
      genealogy: revealGenealogyCharacter({
        expansion: current.genealogy,
        id: characterId,
        lineage: presentation?.genealogy?.allLineage ?? [],
      }),
    }));
    select({ id: characterId, kind: "character" });
  }

  function chooseBranch(branchId: Nullable<string>) {
    setLocal((current) => ({ ...current, branchId }));
    const genealogy = presentation?.genealogy ?? null;
    if (branchId !== null && genealogy !== null) {
      requestCameraFocus(toGenealogyBranchMembers({ branchId, genealogy }));
    }
  }

  function clearBranch() {
    chooseBranch(null);
    focusTrigger(document.getElementById(branchesTriggerId));
  }

  function findCharacter(characterId: string) {
    setLocal((current) => ({ ...current, branchId: null }));
    revealCharacter(characterId);
    requestCameraFocus([characterId]);
  }

  function toggleBranch(characterId: string) {
    setLocal((current) => ({
      ...current,
      genealogy: toggleGenealogyBranch({ expansion: current.genealogy, id: characterId }),
    }));
    requestCameraFocus([characterId]);
  }

  function closePersonPanel() {
    setLocal((current) => ({ ...current, selection: null }));
    setPersonPanel((current) => ({ ...current, intent: "closed" }));
  }

  function restoreFocus() {
    focusTrigger(
      toRestoreTarget({
        fallbackId: statusId,
        trigger: lastTrigger.current,
        useFallback: usesStatusFallback,
      }),
    );
  }

  function saveLayout(snapshot: LayoutSnapshot, confirmed: boolean) {
    const existing = savedLayout.layout.data ?? null;
    if (!confirmed && existing !== null && existing.layoutVersion !== layoutVersion) {
      setLocal((current) => ({ ...current, pendingOverwrite: snapshot }));
      return;
    }
    setLocal((current) => ({ ...current, pendingOverwrite: null }));
    savedLayout.save.mutate(
      {
        layoutVersion,
        positions: toSavedGraphPositions({ allowedIds, positions: snapshot.positions }),
        viewport: snapshot.viewport,
      },
      {
        onError: () => toast.error(t("canvas.saveError")),
        onSuccess: () => toast.success(t("canvas.saved")),
      },
    );
  }

  function resetLayout() {
    const relayout = () =>
      setLocal((current) => ({
        ...current,
        pendingOverwrite: null,
        relayout: current.relayout + 1,
      }));
    if ((savedLayout.layout.data ?? null) === null) {
      relayout();
      return;
    }
    savedLayout.remove.mutate(undefined, {
      onError: () => toast.error(t("canvas.resetError")),
      onSuccess: relayout,
    });
  }

  const networkWorkspace = useGraphNetworkWorkspace({
    bookId,
    camera: {
      focusRequest: local.focusRequest,
      nextNonce: nextFocusNonce,
      request: setFocusRequest,
    },
    hasActiveFilters,
    identityKey,
    isLayoutStale: (savedLayout.layout.data ?? null) !== null && restore === null,
    isNetworkScene,
    local: networkLocal,
    network,
    params,
    presentation,
    reader,
    sceneData: scene.data ?? null,
    selection: {
      live: selection,
      onChange: changeSelection,
      onOpen: openSelection,
      raw: local.selection,
    },
    statusId,
    urlActions,
  });
  const sceneValue: Nullable<GraphSceneValue> =
    presentation === null
      ? null
      : {
          characters: presentation.characters,
          clusters: presentation.clusters,
          connections: new Map(
            presentation.connections.map((connection) => [connection.id, connection] as const),
          ),
          onAggregateOpen: (aggregateId) => select({ id: aggregateId, kind: "aggregate" }),
          onBranchToggle: (characterId) =>
            setLocal((current) => ({
              ...current,
              person: withPersonBranch({
                expansion: current.person,
                nodeId: characterId,
                state: presentation.characters.get(characterId)?.canExpand
                  ? "expanded"
                  : "collapsed",
              }),
            })),
          onCharacterOpen: (characterId) => select({ id: characterId, kind: "character" }),
          onClusterOpen: networkWorkspace.onClusterOpen,
          onConnectionOpen: (connectionId) => select({ id: connectionId, kind: "connection" }),
          selection,
        };

  const genealogyPresentation = presentation?.genealogy ?? null;
  const genealogyBranches =
    presentation === null || genealogyPresentation === null
      ? []
      : toGenealogyBranches({
          genealogy: genealogyPresentation,
          houseMarks: toGenealogyHouseMarks(genealogyPresentation),
          nameOf: (id) => presentation.characters.get(id)?.node.displayName ?? "",
          t,
        });
  const activeBranchId = genealogyBranches.some((branch) => branch.id === local.branchId)
    ? local.branchId
    : null;
  const toolbarGenealogy: Nullable<GraphToolbarGenealogy> =
    presentation === null || genealogyPresentation === null
      ? null
      : {
          activeBranchId,
          branches: genealogyBranches,
          branchesTriggerId,
          characters: genealogyPresentation.allNodes,
          collapsedBranches: genealogyPresentation.scene.collapsedIds.size,
          hiddenCount: genealogyPresentation.scene.hiddenCount,
          hiddenIds: toGenealogyHiddenIds({
            genealogy: genealogyPresentation,
            isVisible: (id) => presentation.characters.has(id),
          }),
          onBranch: chooseBranch,
          onExpandAll: () =>
            setLocal((current) => ({ ...current, genealogy: EMPTY_GENEALOGY_EXPANSION })),
          onFind: findCharacter,
        };
  const restoreVersion = restore === null ? null : layoutVersion;
  const networkKeys = toNetworkSceneKeys({
    allowedIds,
    focusBucketId: networkFocusBucketId,
    identityKey,
    relayout: local.relayout,
    restoreVersion,
  });
  const layoutKey = isNetworkScene
    ? networkKeys.layoutKey
    : toGraphSceneKey([
        identityKey,
        treeOptions,
        [...allowedIds],
        local.relayout,
        restore === null ? null : layoutVersion,
      ]);
  const placementKey = isNetworkScene
    ? networkKeys.layoutKey
    : toGraphSceneKey(
        isPersonScene
          ? [identityKey, local.relayout, local.cameraRestored]
          : [
              identityKey,
              treeOptions,
              local.relayout,
              restore === null ? null : layoutVersion,
              [...local.genealogy.collapsedIds].sort(),
            ],
      );
  const sceneKey = isNetworkScene
    ? networkKeys.sceneKey
    : toGraphSceneKey(
        isPersonScene
          ? [identityKey, local.relayout, local.cameraRestored]
          : [identityKey, restore === null ? null : layoutVersion],
      );
  const hiddenSelection = isTreeScene
    ? toHiddenSelection({ data: scene.data ?? null, presentation, selection: local.selection })
    : null;

  const viewSwitch = (
    <Segmented
      block={widthClass === "compact"}
      label={t("views.label")}
      onValueChange={(next) => {
        const view = GRAPH_WORKSPACE_VIEWS.find((entry) => entry === next);
        if (view !== undefined) actions.setView(view);
      }}
      options={GRAPH_WORKSPACE_VIEWS.map((view) => ({
        label: isTreeScene ? (
          <>
            <span className="@6xl/workspace:hidden">{t(`views.short.${view}`)}</span>
            <span className="hidden @6xl/workspace:inline">{t(`views.${view}`)}</span>
          </>
        ) : (
          <>
            <span className="@lg/workspace:hidden">{t(`views.short.${view}`)}</span>
            <span className="hidden @lg/workspace:inline">{t(`views.${view}`)}</span>
          </>
        ),
        value: view,
      }))}
      tone="accent"
      value={params.view}
    />
  );
  const modeSwitch =
    params.view === "tree" ? (
      <div className="flex flex-wrap items-center gap-2">
        {viewSwitch}
        <GraphTreeScopeSwitch actions={actions} params={params} />
      </div>
    ) : (
      viewSwitch
    );

  return (
    <div
      className={cn(
        "@container/workspace flex flex-col",
        isPanelScene ? "gap-3" : "gap-4",
        isSceneMode && "graph-workspace-viewport",
        immersive && "graph-workspace-immersive overflow-y-auto bg-background p-3 sm:p-4",
      )}
      ref={containerRef}
    >
      {immersive ? null : <GraphWorkspaceHeader book={book} decorated={isPersonScene} />}
      {params.path ? (
        <GraphPathExplorer
          actions={actions}
          bookId={bookId}
          params={params}
          reader={reader}
          relationshipActions={authoring.actions}
          widthClass={widthClass}
        />
      ) : (
        <>
          <div className={cn("flex flex-col", isPanelScene ? "gap-2" : "gap-3")}>
            {immersive && isTreeScene ? null : isStatusInline ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {modeSwitch}
                {isSceneError ? null : (
                  <p aria-hidden className="text-sm text-muted-foreground">
                    {counterText ?? t("states.loading")}
                  </p>
                )}
              </div>
            ) : (
              modeSwitch
            )}
            <GraphWorkspaceToolbar
              actions={actions}
              bookId={bookId}
              filtersTriggerId={filtersTriggerId}
              genealogy={isGenealogyScene ? toolbarGenealogy : null}
              networkSearch={networkWorkspace.search}
              onTreeOptionsChange={actions.setTreeOptions}
              onTreeOptionsReset={actions.resetTreeLinks}
              params={params}
              rootParticipant={toRootParticipant({ presentation, rootId: params.characterId })}
              treeOptions={treeOptions}
              widthClass={sceneWidthClass}
            />
            {isTreeScene ? null : (
              <GraphActiveFilters
                categories={params.categories}
                filtersTriggerId={filtersTriggerId}
                onChange={actions.setFilters}
                onReset={actions.resetFilters}
                types={params.types}
              />
            )}
          </div>
          {sceneRequest === null && params.view !== "network" ? (
            <GraphGuidedStart book={book} onChoose={actions.chooseCharacter} view={params.view} />
          ) : (
            <GraphSceneSection
              actions={actions}
              bookId={bookId}
              genealogyNav={{
                activeBranchId,
                branches: genealogyBranches,
                focusRequest: local.focusRequest,
                onBranch: chooseBranch,
                onClearBranch: clearBranch,
              }}
              hiddenSelection={hiddenSelection}
              immersive={immersive}
              isError={isSceneError}
              isNotFound={isUnavailable}
              layout={{
                canSave: presentation !== null && !scene.isFetching,
                hasSaved: (savedLayout.layout.data ?? null) !== null,
                isBusy: savedLayout.save.isPending || savedLayout.remove.isPending,
                onReset: resetLayout,
                onSave: (snapshot) => saveLayout(snapshot, false),
              }}
              layoutKey={layoutKey}
              networkNav={networkWorkspace.nav}
              onClearSelection={() => select(null)}
              onConfirmOverwrite={() => {
                if (local.pendingOverwrite !== null) saveLayout(local.pendingOverwrite, true);
              }}
              onDismissHiddenSelection={() => {
                select(null);
                focusTrigger(document.getElementById(statusId));
              }}
              onDismissOverwrite={() =>
                setLocal((current) => ({ ...current, pendingOverwrite: null }))
              }
              onMoreHop={(hop) =>
                setLocal((current) => ({
                  ...current,
                  person: withPersonMore({ expansion: current.person, hop }),
                }))
              }
              onRestoreFocus={restoreFocus}
              onRetry={() => void scene.refetch()}
              onRevealCharacter={findCharacter}
              onToggleBranch={toggleBranch}
              onToggleImmersive={() => setImmersive((current) => !current)}
              params={params}
              pendingOverwrite={local.pendingOverwrite !== null}
              personPanel={
                isPersonScene ? { isOpen: isPersonPanelOpen, onClose: closePersonPanel } : null
              }
              placementKey={placementKey}
              presentation={presentation}
              reader={reader}
              relationshipActions={authoring.actions}
              restore={restore}
              sceneKey={sceneKey}
              sceneValue={sceneValue}
              selection={selection}
              statusId={statusId}
              statusInline={isStatusInline}
              treeOptions={treeOptions}
              treePanel={
                isTreeScene ? { isOpen: isPersonPanelOpen, onClose: closePersonPanel } : null
              }
              widthClass={sceneWidthClass}
            />
          )}
        </>
      )}
      {authoring.dialogs}
    </div>
  );
}

function createLocalState({
  identityKey,
  rootId,
  selection,
  view,
}: CreateLocalStateInput): WorkspaceLocalState {
  return {
    branchId: null,
    cameraRestored: false,
    cameraSettled: false,
    focusRequest: null,
    genealogy: EMPTY_GENEALOGY_EXPANSION,
    identityKey,
    pendingOverwrite: null,
    person: EMPTY_PERSON_EXPANSION,
    relayout: 0,
    rootId,
    selection,
    view,
  };
}

function focusTrigger(trigger: Nullable<HTMLElement>): void {
  requestAnimationFrame(() => {
    if (trigger !== null && trigger.isConnected) trigger.focus();
  });
}

function makeSurroundingsInert(element: HTMLElement): () => void {
  const inerted: HTMLElement[] = [];
  let current = element;
  while (current.parentElement !== null && current !== document.body) {
    for (const sibling of current.parentElement.children) {
      if (
        sibling !== current &&
        sibling instanceof HTMLElement &&
        sibling.tagName !== "HEADER" &&
        !sibling.inert
      ) {
        sibling.inert = true;
        inerted.push(sibling);
      }
    }
    current = current.parentElement;
  }
  return () => {
    for (const entry of inerted) entry.inert = false;
  };
}

function reconcileSelection({
  network,
  presentation,
  selection,
}: {
  network: Nullable<GraphNetworkPresentation>;
  presentation: Nullable<GraphWorkspacePresentation>;
  selection: GraphSceneSelection;
}): GraphSceneSelection {
  if (presentation === null || selection === null) return null;
  if (network !== null) return isNetworkSelectionLive({ network, selection }) ? selection : null;
  if (selection.kind === "character") {
    return presentation.characters.has(selection.id) ? selection : null;
  }
  return presentation.connections.some((connection) => connection.id === selection.id)
    ? selection
    : null;
}

function toHiddenSelection({
  data,
  presentation,
  selection,
}: {
  data: Nullable<GraphWorkspaceSceneData>;
  presentation: Nullable<GraphWorkspacePresentation>;
  selection: GraphSceneSelection;
}): Nullable<GraphHiddenSelection> {
  if (data === null || presentation === null || selection?.kind !== "character") return null;
  if (presentation.characters.has(selection.id)) return null;
  const node = toSceneNodes(data).find((entry) => entry.id === selection.id);
  if (node === undefined) return null;
  const isCollapsed =
    presentation.genealogy?.allNodes.some((entry) => entry.id === selection.id) === true;
  return { id: node.id, name: node.displayName, reason: isCollapsed ? "collapsed" : "filtered" };
}

function toLayoutSceneParts({
  identityKey,
  networkFocusBucketId,
  params,
  treeOptions,
}: {
  identityKey: string;
  networkFocusBucketId: Nullable<string>;
  params: GraphWorkspaceParams;
  treeOptions: TreeOptions;
}): readonly unknown[] {
  if (params.path) return [identityKey, params.view, treeOptions];
  if (params.view === "person") {
    return [identityKey, params.view, treeOptions, PERSON_LAYOUT.revision];
  }
  if (params.view === "tree" && params.treeScope === "full") {
    return [identityKey, "genealogy", treeOptions, GENEALOGY_LAYOUT.revision];
  }
  if (params.view === "tree") return [identityKey, params.view, treeOptions, TREE_LAYOUT.revision];
  return [identityKey, "network", NETWORK_LAYOUT.revision, networkFocusBucketId];
}

function toRestoreTarget({
  fallbackId,
  trigger,
  useFallback,
}: {
  fallbackId: string;
  trigger: Nullable<HTMLElement>;
  useFallback: boolean;
}): Nullable<HTMLElement> {
  if (trigger !== null && trigger.isConnected) return trigger;
  return useFallback ? document.getElementById(fallbackId) : trigger;
}

function toRootParticipant({
  presentation,
  rootId,
}: {
  presentation: Nullable<GraphWorkspacePresentation>;
  rootId: Nullable<string>;
}) {
  if (rootId === null || presentation === null) return null;
  const root = presentation.characters.get(rootId)?.node;
  if (root === undefined) return null;
  return {
    avatarUrl: root.displayMedia?.urls.thumb ?? null,
    id: root.id,
    name: root.displayName,
  };
}

function toSceneNodes(data: GraphWorkspaceSceneData) {
  if (data.kind === "genealogy") return data.genealogy.nodes;
  return data.kind === "tree" ? data.tree.nodes : data.graph.nodes;
}

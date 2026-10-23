"use client";

import type { BookDetailsView, CharacterGraphViewport, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { RelationshipGraphLayoutKey } from "../../model/relationship-graph-scope";
import type { RelationshipScope } from "../../model/relationship-scope";
import type { NetworkExpansion } from "../../model/workspace/graph-network-scene";
import type { PersonExpansion } from "../../model/workspace/graph-person-scene";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";
import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";

import {
  isGraphWorkspaceNotFound,
  useGraphWorkspaceScene,
} from "../../api/use-graph-workspace-queries";
import { useRelationshipGraphLayout } from "../../api/use-relationship-graph-layout";
import {
  EMPTY_NETWORK_EXPANSION,
  toggleNetworkCluster,
  withMoreNetworkMembers,
} from "../../model/workspace/graph-network-scene";
import {
  EMPTY_PERSON_EXPANSION,
  withPersonBranch,
  withPersonMore,
} from "../../model/workspace/graph-person-scene";
import { TREE_SCENE } from "../../model/workspace/graph-tree-scene";
import { GRAPH_WORKSPACE_VIEWS } from "../../model/workspace/graph-workspace-params";
import { buildGraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import {
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
import { GraphGuidedStart } from "./graph-guided-start";
import { GraphPathExplorer } from "./graph-path-explorer";
import { GraphSceneSection } from "./graph-scene-section";
import { GraphWorkspaceHeader } from "./graph-workspace-header";
import { GraphWorkspaceToolbar } from "./graph-workspace-toolbar";
import { useWorkspaceWidthClass } from "./use-workspace-width-class";

type GraphWorkspaceShellProps = {
  book: BookDetailsView;
};

type LayoutSnapshot = {
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  viewport: CharacterGraphViewport;
};

type WorkspaceLocalState = {
  identityKey: string;
  network: NetworkExpansion;
  pendingOverwrite: Nullable<LayoutSnapshot>;
  person: PersonExpansion;
  relayout: number;
  selection: GraphSceneSelection;
};

export function GraphWorkspaceShell({ book }: GraphWorkspaceShellProps) {
  const t = useTranslations("relationships.workspace");
  const bookId = book.id;
  const { actions, params } = useGraphWorkspaceState();
  const reader = toGraphReaderKey(book);
  const sceneRequest = toGraphWorkspaceSceneRequest(params);
  const scene = useGraphWorkspaceScene({ bookId, reader, request: sceneRequest });
  const { element: container, ref: containerRef, widthClass } = useWorkspaceWidthClass();
  const [immersive, setImmersive] = useState(false);
  const [treeOptions, setTreeOptions] = useState<TreeOptions>(TREE_SCENE.defaultOptions);
  const lastTrigger = useRef<Nullable<HTMLElement>>(null);
  const scope: RelationshipScope = { bookId, kind: "book" };
  const authoring = useRelationshipAuthoring({
    bookOptions: [{ id: bookId, title: book.title }],
    scope,
  });

  const identityKey = toGraphSceneKey([bookId, reader, sceneRequest, params.networkGroup]);
  const [local, setLocal] = useState<WorkspaceLocalState>(() => createLocalState(identityKey));
  if (local.identityKey !== identityKey) setLocal(createLocalState(identityKey));

  const presentation =
    scene.data === undefined || params.path
      ? null
      : buildGraphWorkspacePresentation({
          data: scene.data,
          network: local.network,
          params,
          person: local.person,
          treeOptions,
        });

  const isUnavailable =
    isGraphWorkspaceNotFound(scene.error) ||
    (scene.isSuccess && presentation === null && !params.path);

  const storageKey: RelationshipGraphLayoutKey = {
    contextBookId: null,
    mode: params.view,
    scopeId: bookId,
    scopeType: "book",
  };
  const savedLayout = useRelationshipGraphLayout(storageKey, { enabled: presentation !== null });
  const allowedIds = new Set(presentation?.positions.keys() ?? []);
  const layoutVersion = toGraphLayoutVersion({
    bookId,
    nodeIds: [...allowedIds],
    reader,
    sceneKey: toGraphSceneKey([identityKey, params.view, treeOptions]),
  });
  const restore = toRestoredGraphLayout({
    allowedIds,
    layout: savedLayout.layout.data ?? null,
    layoutVersion,
  });

  const selection = reconcileSelection({ presentation, selection: local.selection });
  const hasSelection = selection !== null;

  useEffect(() => {
    if (!hasSelection && !immersive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]') !== null) return;
      if (hasSelection) {
        setLocal((current) => ({ ...current, selection: null }));
        focusTrigger(lastTrigger.current);
        return;
      }
      setImmersive(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasSelection, immersive]);

  useEffect(() => {
    if (!immersive || container === null) return;
    return makeSurroundingsInert(container);
  }, [container, immersive]);

  function select(next: GraphSceneSelection) {
    if (
      next !== null &&
      local.selection === null &&
      document.activeElement instanceof HTMLElement
    ) {
      lastTrigger.current = document.activeElement;
    }
    setLocal((current) => ({ ...current, selection: next }));
  }

  function restoreFocus() {
    focusTrigger(lastTrigger.current);
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

  const sceneValue: Nullable<GraphSceneValue> =
    presentation === null
      ? null
      : {
          characters: presentation.characters,
          clusters: presentation.clusters,
          connections: new Map(
            presentation.connections.map((connection) => [connection.id, connection] as const),
          ),
          onAggregateOpen: (sourceId, targetId) =>
            setLocal((current) => ({
              ...current,
              network: [sourceId, targetId]
                .filter(
                  (id) => presentation.clusters.has(id) && !current.network.expandedIds.has(id),
                )
                .reduce(
                  (expansion, bucketId) => toggleNetworkCluster({ bucketId, expansion }),
                  current.network,
                ),
            })),
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
          onClusterMore: (bucketId) =>
            setLocal((current) => ({
              ...current,
              network: withMoreNetworkMembers({ bucketId, expansion: current.network }),
            })),
          onClusterToggle: (bucketId) =>
            setLocal((current) => ({
              ...current,
              network: toggleNetworkCluster({ bucketId, expansion: current.network }),
            })),
          onConnectionOpen: (connectionId) => select({ id: connectionId, kind: "connection" }),
          selection,
        };

  return (
    <div
      className={cn(
        "@container/workspace flex flex-col gap-4",
        immersive && "fixed inset-0 z-50 overflow-y-auto bg-background p-3 sm:p-4",
      )}
      ref={containerRef}
    >
      {immersive ? null : <GraphWorkspaceHeader book={book} />}
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
          <div className="flex flex-col gap-3">
            <Segmented
              block={widthClass === "compact"}
              label={t("views.label")}
              onValueChange={(next) => {
                const view = GRAPH_WORKSPACE_VIEWS.find((entry) => entry === next);
                if (view !== undefined) actions.setView(view);
              }}
              options={GRAPH_WORKSPACE_VIEWS.map((view) => ({
                label: t(`views.${view}`),
                value: view,
              }))}
              tone="accent"
              value={params.view}
            />
            <GraphWorkspaceToolbar
              actions={actions}
              bookId={bookId}
              onTreeOptionsChange={setTreeOptions}
              params={params}
              rootParticipant={toRootParticipant({ presentation, rootId: params.characterId })}
              treeOptions={treeOptions}
            />
            <GraphActiveFilters
              categories={params.categories}
              dormant={params.view === "tree"}
              onChange={actions.setFilters}
              onReset={actions.resetFilters}
              types={params.types}
            />
          </div>
          {sceneRequest === null && params.view !== "network" ? (
            <GraphGuidedStart book={book} onChoose={actions.chooseCharacter} view={params.view} />
          ) : (
            <GraphSceneSection
              actions={actions}
              bookId={bookId}
              immersive={immersive}
              isError={(scene.isError && scene.data === undefined) || isUnavailable}
              isNotFound={isUnavailable}
              layout={{
                canSave: presentation !== null && !scene.isFetching,
                hasSaved: (savedLayout.layout.data ?? null) !== null,
                isBusy: savedLayout.save.isPending || savedLayout.remove.isPending,
                onReset: resetLayout,
                onSave: (snapshot) => saveLayout(snapshot, false),
              }}
              layoutKey={toGraphSceneKey([
                identityKey,
                treeOptions,
                [...allowedIds],
                local.relayout,
                restore === null ? null : layoutVersion,
              ])}
              onClearSelection={() => select(null)}
              onConfirmOverwrite={() => {
                if (local.pendingOverwrite !== null) saveLayout(local.pendingOverwrite, true);
              }}
              onDismissOverwrite={() =>
                setLocal((current) => ({ ...current, pendingOverwrite: null }))
              }
              onMoreClusters={() =>
                setLocal((current) => ({
                  ...current,
                  network: { ...current.network, extraClusters: current.network.extraClusters + 1 },
                }))
              }
              onMoreHop={(hop) =>
                setLocal((current) => ({
                  ...current,
                  person: withPersonMore({ expansion: current.person, hop }),
                }))
              }
              onRestoreFocus={restoreFocus}
              onRetry={() => void scene.refetch()}
              onToggleImmersive={() => setImmersive((current) => !current)}
              params={params}
              pendingOverwrite={local.pendingOverwrite !== null}
              placementKey={toGraphSceneKey([
                identityKey,
                treeOptions,
                local.relayout,
                restore === null ? null : layoutVersion,
              ])}
              presentation={presentation}
              reader={reader}
              relationshipActions={authoring.actions}
              restore={restore}
              sceneKey={toGraphSceneKey([identityKey, restore === null ? null : layoutVersion])}
              sceneValue={sceneValue}
              selection={selection}
              widthClass={widthClass}
            />
          )}
        </>
      )}
      {authoring.dialogs}
    </div>
  );
}

function createLocalState(identityKey: string): WorkspaceLocalState {
  return {
    identityKey,
    network: EMPTY_NETWORK_EXPANSION,
    pendingOverwrite: null,
    person: EMPTY_PERSON_EXPANSION,
    relayout: 0,
    selection: null,
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
      if (sibling !== current && sibling instanceof HTMLElement && !sibling.inert) {
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
  presentation,
  selection,
}: {
  presentation: Nullable<GraphWorkspacePresentation>;
  selection: GraphSceneSelection;
}): GraphSceneSelection {
  if (presentation === null || selection === null) return null;
  if (selection.kind === "character") {
    return presentation.characters.has(selection.id) ? selection : null;
  }
  return presentation.connections.some((connection) => connection.id === selection.id)
    ? selection
    : null;
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

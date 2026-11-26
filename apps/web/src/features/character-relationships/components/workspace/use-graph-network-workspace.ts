"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useId, useRef, useState } from "react";

import { assertNever } from "@/lib/assert-never";

import type { NetworkExpansion } from "../../model/workspace/graph-network-scene";
import type { GraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import type {
  GraphNetworkPresentation,
  GraphWorkspacePresentation,
} from "../../model/workspace/graph-workspace-presentation";
import type {
  GraphReaderKey,
  GraphWorkspaceSceneData,
  GraphWorkspaceSceneRequest,
} from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphNetworkNotice, GraphNetworkNoticeKind } from "./graph-network-notices";
import type { GraphNetworkNavigation } from "./graph-network-scene";
import type { GraphSceneSelection } from "./graph-scene-context";
import type { GraphGenealogyFocusRequest } from "./graph-tree-scene-context";
import type { GraphToolbarNetworkSearch } from "./graph-workspace-toolbar";

import { useGraphWorkspaceScene } from "../../api/use-graph-workspace-queries";
import { buildNetworkIndex } from "../../model/workspace/graph-network-index";
import {
  EMPTY_NETWORK_EXPANSION,
  toNetworkLinkExplore,
  withMoreNetworkMembers,
  withNetworkFocus,
} from "../../model/workspace/graph-network-scene";
import { toGraphSceneKey } from "../../model/workspace/graph-workspace-signature";
import { useNetworkBucketLabel } from "./use-network-bucket-label";

const NETWORK_WORKSPACE: {
  focusAttempts: number;
  unfilteredRequest: GraphWorkspaceSceneRequest;
} = {
  focusAttempts: 30,
  unfilteredRequest: { filters: { categories: [], types: [] }, kind: "network" },
};

type GraphNetworkLocal = {
  state: NetworkLocalState;
  update: (change: (state: NetworkLocalState) => NetworkLocalState) => void;
};

type GraphNetworkWorkspace = {
  nav: Nullable<GraphNetworkNavigation>;
  onClusterOpen: (bucketId: string) => void;
  search: Nullable<GraphToolbarNetworkSearch>;
};

type NetworkLayoutNotice =
  { bucketId: Nullable<string>; kind: "shown" } | { kind: "dismissed" } | { kind: "unseen" };

type NetworkLocalState = {
  blocked: Nullable<{ id: string; name: string }>;
  carriedSelection: GraphSceneSelection;
  expansion: NetworkExpansion;
  focusKey: Nullable<string>;
  identityKey: string;
  isFocusMissing: boolean;
  layoutNotice: NetworkLayoutNotice;
  pendingPick: Nullable<NetworkPendingPick>;
};

type NetworkPendingPick = { id: string; nonce: number };

type NetworkSceneFocus =
  { bucketId: string; kind: "returning" } | { kind: "revealed"; previousIds: ReadonlySet<string> };

type UseGraphNetworkWorkspaceInput = {
  bookId: string;
  camera: {
    focusRequest: Nullable<GraphGenealogyFocusRequest>;
    nextNonce: () => number;
    request: (request: GraphGenealogyFocusRequest) => void;
  };
  hasActiveFilters: boolean;
  identityKey: string;
  isLayoutStale: boolean;
  isNetworkScene: boolean;
  local: GraphNetworkLocal;
  network: Nullable<GraphNetworkPresentation>;
  params: Pick<GraphWorkspaceParams, "networkFocus" | "networkGroup">;
  presentation: Nullable<GraphWorkspacePresentation>;
  reader: GraphReaderKey;
  sceneData: Nullable<GraphWorkspaceSceneData>;
  selection: {
    live: GraphSceneSelection;
    onChange: (change: (selection: GraphSceneSelection) => GraphSceneSelection) => void;
    onOpen: (input: {
      selection: NonNullable<GraphSceneSelection>;
      trigger: Nullable<Element>;
    }) => void;
    raw: GraphSceneSelection;
  };
  statusId: string;
  urlActions: Pick<
    GraphWorkspaceState["actions"],
    "clearNetworkFocus" | "focusNetworkGroup" | "resetFilters" | "setNetworkGroup"
  >;
};

export function toNetworkFocusBucketId(
  network: Nullable<GraphNetworkPresentation>,
): Nullable<string> {
  return network?.scene.kind === "focus" ? network.scene.bucket.id : null;
}

export function toNetworkSceneKeys({
  allowedIds,
  focusBucketId,
  identityKey,
  relayout,
  restoreVersion,
}: {
  allowedIds: ReadonlySet<string>;
  focusBucketId: Nullable<string>;
  identityKey: string;
  relayout: number;
  restoreVersion: Nullable<string>;
}): { layoutKey: string; sceneKey: string } {
  return {
    layoutKey: toGraphSceneKey([
      identityKey,
      focusBucketId,
      [...allowedIds].sort((left, right) => left.localeCompare(right)),
      relayout,
      restoreVersion,
    ]),
    sceneKey: toGraphSceneKey([identityKey, focusBucketId, restoreVersion]),
  };
}

export function useGraphNetworkLocal({
  carriesNetwork,
  identityKey,
  networkFocus,
  selection,
}: {
  carriesNetwork: boolean;
  identityKey: string;
  networkFocus: Nullable<string>;
  selection: GraphSceneSelection;
}): GraphNetworkLocal {
  const [state, setState] = useState(() => createNetworkLocalState({ identityKey, networkFocus }));
  if (state.identityKey !== identityKey) {
    setState({
      ...createNetworkLocalState({ identityKey, networkFocus }),
      carriedSelection: carriesNetwork ? selection : null,
      pendingPick: carriesNetwork ? state.pendingPick : null,
    });
  }
  return { state, update: setState };
}

export function useGraphNetworkWorkspace({
  bookId,
  camera,
  hasActiveFilters,
  identityKey,
  isLayoutStale,
  isNetworkScene,
  local,
  network,
  params,
  presentation,
  reader,
  sceneData,
  selection,
  statusId,
  urlActions,
}: UseGraphNetworkWorkspaceInput): GraphNetworkWorkspace {
  const toBucketLabel = useNetworkBucketLabel();
  const [isSearchOpen, setSearchOpen] = useState(false);
  const searchTriggerId = useId();
  const clearedFocusKey = useRef<Nullable<string>>(null);
  const sceneFocus = useRef<Nullable<NetworkSceneFocus>>(null);
  const unfilteredScene = useGraphWorkspaceScene({
    bookId,
    reader,
    request:
      isNetworkScene && isSearchOpen && hasActiveFilters
        ? NETWORK_WORKSPACE.unfilteredRequest
        : null,
  });
  const { state } = local;
  const isCurrent = state.identityKey === identityKey;
  const focusBucketId = toNetworkFocusBucketId(network);
  const missingFocusKey = network?.focusMissing === true ? params.networkFocus : null;
  const clearNetworkFocus = urlActions.clearNetworkFocus;
  const nodeIds =
    network === null || presentation === null
      ? []
      : [...presentation.characters.keys(), ...presentation.clusters.keys()];

  if (network !== null && state.focusKey !== params.networkFocus) {
    local.update((current) => ({
      ...current,
      expansion: withNetworkFocus({ bucketId: focusBucketId, expansion: current.expansion }),
      focusKey: params.networkFocus,
    }));
    if (selection.raw?.kind === "members") {
      selection.onChange((current) => (current?.kind === "members" ? null : current));
    }
  }
  if (missingFocusKey !== null && !state.isFocusMissing) {
    local.update((current) => ({ ...current, isFocusMissing: true }));
  }
  if (focusBucketId !== null && state.isFocusMissing) {
    local.update((current) => ({ ...current, isFocusMissing: false }));
  }
  const pendingPick = state.pendingPick;
  if (network !== null && pendingPick !== null) {
    const pickBucketId = network.index.bucketIdByNodeId.get(pendingPick.id) ?? null;
    local.update((current) => ({
      ...current,
      expansion:
        pickBucketId === null
          ? current.expansion
          : withNetworkFocus({
              bucketId: pickBucketId,
              expansion: current.expansion,
              revealIds: [pendingPick.id],
            }),
      pendingPick: null,
    }));
    if (pickBucketId !== null) {
      camera.request({ ids: [pendingPick.id], nonce: pendingPick.nonce });
      selection.onChange(() => ({ id: pendingPick.id, kind: "character" }));
    }
  }

  const staleSelection =
    network !== null && selection.raw !== null && selection.live === null ? selection.raw : null;
  const isCarried = state.carriedSelection !== null && state.carriedSelection === selection.raw;
  const hasLiveSelection = network !== null && selection.live !== null;
  if (isCurrent && staleSelection !== null && !isCarried) {
    selection.onChange((current) => (current === staleSelection ? null : current));
  }
  if (isCurrent && hasLiveSelection && state.carriedSelection !== null) {
    local.update((current) => ({ ...current, carriedSelection: null }));
  }

  const layoutNotice = state.layoutNotice;
  if (isCurrent && network !== null && isLayoutStale && layoutNotice.kind === "unseen") {
    local.update((current) => ({
      ...current,
      layoutNotice: { bucketId: focusBucketId, kind: "shown" },
    }));
  }
  if (
    isCurrent &&
    network !== null &&
    layoutNotice.kind === "shown" &&
    layoutNotice.bucketId !== focusBucketId
  ) {
    local.update((current) => ({ ...current, layoutNotice: { kind: "dismissed" } }));
  }
  const showsLayoutNotice =
    isLayoutStale &&
    (layoutNotice.kind === "unseen" ||
      (layoutNotice.kind === "shown" && layoutNotice.bucketId === focusBucketId));

  useEffect(() => {
    if (missingFocusKey === null) {
      clearedFocusKey.current = null;
      return;
    }
    if (clearedFocusKey.current === missingFocusKey) return;
    clearedFocusKey.current = missingFocusKey;
    clearNetworkFocus();
  }, [clearNetworkFocus, missingFocusKey]);

  useEffect(() => {
    const pending = sceneFocus.current;
    if (pending === null) return;
    if (pending.kind === "returning") {
      if (focusBucketId !== null) return;
      sceneFocus.current = null;
      focusNodeWhenReady({ fallbackId: statusId, nodeId: pending.bucketId });
      return;
    }
    sceneFocus.current = null;
    focusNodeWhenReady({
      fallbackId: statusId,
      nodeId: nodeIds.find((id) => !pending.previousIds.has(id)) ?? null,
    });
  });

  function activeTrigger(): Nullable<Element> {
    return selection.raw === null ? document.activeElement : null;
  }

  function requestFocus(ids: readonly string[]) {
    if (ids.length === 0) return;
    camera.request({ ids, nonce: camera.nextNonce() });
  }

  function focusBucket(bucketId: Nullable<string>) {
    if (network === null) return;
    const key = bucketId === null ? null : (network.index.bucketById.get(bucketId)?.key ?? null);
    if (bucketId !== null && key === null) return;
    local.update((current) => ({
      ...current,
      expansion: withNetworkFocus({ bucketId, expansion: current.expansion }),
      isFocusMissing: false,
    }));
    if (key !== params.networkFocus) urlActions.focusNetworkGroup(key);
    if (bucketId !== null) {
      focusStatusSoon(statusId);
      return;
    }
    if (focusBucketId !== null) sceneFocus.current = { bucketId: focusBucketId, kind: "returning" };
  }

  function pickCharacter({
    characterId,
    trigger,
  }: {
    characterId: string;
    trigger: Nullable<Element>;
  }) {
    if (network === null) return;
    const bucketId = network.index.bucketIdByNodeId.get(characterId);
    const bucket = bucketId === undefined ? undefined : network.index.bucketById.get(bucketId);
    if (bucket === undefined) return;
    local.update((current) => ({
      ...current,
      expansion: withNetworkFocus({
        bucketId: bucket.id,
        expansion: current.expansion,
        revealIds: [characterId],
      }),
      isFocusMissing: false,
    }));
    if (bucket.key !== params.networkFocus) urlActions.focusNetworkGroup(bucket.key);
    selection.onOpen({ selection: { id: characterId, kind: "character" }, trigger });
    requestFocus([characterId]);
  }

  function exploreLink({ aggregateId, bucketId }: { aggregateId: string; bucketId: string }) {
    if (network === null) return;
    const link = [...network.index.bucketLinks, ...network.scene.links].find(
      (entry) => entry.id === aggregateId,
    );
    if (link === undefined) return;
    const explore = toNetworkLinkExplore({ bucketId, index: network.index, link });
    const key = network.index.bucketById.get(bucketId)?.key;
    if (explore === null || key === undefined) return;
    local.update((current) => ({
      ...current,
      carriedSelection: null,
      expansion: withNetworkFocus({
        bucketId,
        expansion: current.expansion,
        revealIds: explore.revealIds,
      }),
      isFocusMissing: false,
    }));
    selection.onChange(() => null);
    if (key !== params.networkFocus) urlActions.focusNetworkGroup(key);
    focusStatusSoon(statusId);
  }

  function resetBlocked() {
    const blocked = state.blocked;
    if (blocked === null) return;
    const unfiltered = unfilteredScene.data;
    const index =
      unfiltered?.kind === "graph"
        ? buildNetworkIndex({ graph: unfiltered.graph, grouping: params.networkGroup })
        : null;
    const bucketId = index?.bucketIdByNodeId.get(blocked.id);
    const key = bucketId === undefined ? undefined : index?.bucketById.get(bucketId)?.key;
    const pick = { id: blocked.id, nonce: camera.nextNonce() };
    local.update((current) => ({ ...current, blocked: null, pendingPick: pick }));
    urlActions.resetFilters();
    if (key !== undefined && key !== params.networkFocus) urlActions.focusNetworkGroup(key);
    focusStatusSoon(statusId);
  }

  function dismissNotice(kind: GraphNetworkNoticeKind) {
    switch (kind) {
      case "blocked":
        local.update((current) => ({ ...current, blocked: null }));
        break;
      case "focusMissing":
        local.update((current) => ({ ...current, isFocusMissing: false }));
        break;
      case "layoutStale":
        local.update((current) => ({ ...current, layoutNotice: { kind: "dismissed" } }));
        break;
      case "staleSelection":
        local.update((current) => ({ ...current, carriedSelection: null }));
        selection.onChange(() => null);
        break;
      default:
        assertNever(kind);
    }
    focusStatusSoon(statusId);
  }

  function revealMore(change: (expansion: NetworkExpansion) => NetworkExpansion) {
    sceneFocus.current = { kind: "revealed", previousIds: new Set(nodeIds) };
    local.update((current) => ({ ...current, expansion: change(current.expansion) }));
  }

  const unfilteredData = unfilteredScene.data;
  const search: Nullable<GraphToolbarNetworkSearch> =
    network === null
      ? null
      : {
          blockedNodes:
            hasActiveFilters && unfilteredData?.kind === "graph"
              ? unfilteredData.graph.nodes.filter((node) => !network.index.nodeById.has(node.id))
              : [],
          index: network.index,
          labelOf: (bucket) => toBucketLabel(bucket.label),
          onOpenChange: setSearchOpen,
          onPickBlocked: (node) =>
            local.update((current) => ({
              ...current,
              blocked: { id: node.id, name: node.displayName },
            })),
          onPickCharacter: (characterId) =>
            pickCharacter({
              characterId,
              trigger: document.getElementById(searchTriggerId),
            }),
          onPickGroup: focusBucket,
          triggerId: searchTriggerId,
        };
  const nav: Nullable<GraphNetworkNavigation> =
    network === null
      ? null
      : {
          cameraKey: toGraphSceneKey([identityKey, focusBucketId]),
          canUseGroupGrouping:
            sceneData?.kind === "graph" &&
            sceneData.graph.clusters.some((cluster) => cluster.kind === "group"),
          focusRequest: camera.focusRequest,
          notices: toNetworkNotices({
            blocked: state.blocked,
            isFocusMissing: state.isFocusMissing,
            isLayoutStale: showsLayoutNotice,
            staleSelection: isCarried ? staleSelection : null,
          }),
          onDismissNotice: dismissNotice,
          onExplore: exploreLink,
          onFocusGroup: focusBucket,
          onMoreClusters: () =>
            revealMore((expansion) => ({
              ...expansion,
              extraClusters: expansion.extraClusters + 1,
            })),
          onMoreMembers: () =>
            revealMore((expansion) =>
              withMoreNetworkMembers(withNetworkFocus({ bucketId: focusBucketId, expansion })),
            ),
          onOpenMembers: () => {
            if (focusBucketId === null) return;
            selection.onOpen({
              selection: { id: focusBucketId, kind: "members" },
              trigger: activeTrigger(),
            });
          },
          onPickCharacter: (characterId) =>
            pickCharacter({ characterId, trigger: activeTrigger() }),
          onRequestFocus: requestFocus,
          onResetBlocked: resetBlocked,
          onResetFilters: () => {
            urlActions.resetFilters();
            focusStatusSoon(statusId);
          },
          onUseGroupGrouping: () => urlActions.setNetworkGroup("group"),
        };

  return { nav, onClusterOpen: focusBucket, search };
}

function createNetworkLocalState({
  identityKey,
  networkFocus,
}: {
  identityKey: string;
  networkFocus: Nullable<string>;
}): NetworkLocalState {
  return {
    blocked: null,
    carriedSelection: null,
    expansion: EMPTY_NETWORK_EXPANSION,
    focusKey: networkFocus,
    identityKey,
    isFocusMissing: false,
    layoutNotice: { kind: "unseen" },
    pendingPick: null,
  };
}

function focusNodeWhenReady({
  fallbackId,
  nodeId,
}: {
  fallbackId: string;
  nodeId: Nullable<string>;
}): void {
  const selector =
    nodeId === null ? null : `.react-flow__node[data-id="${CSS.escape(nodeId)}"] button`;
  let attempt = 0;
  const tryFocus = () => {
    const element = selector === null ? null : document.querySelector<HTMLElement>(selector);
    element?.focus({ preventScroll: true });
    if (element !== null && document.activeElement === element) return;
    attempt += 1;
    if (selector !== null && attempt < NETWORK_WORKSPACE.focusAttempts) {
      requestAnimationFrame(tryFocus);
      return;
    }
    document.getElementById(fallbackId)?.focus();
  };
  requestAnimationFrame(tryFocus);
}

function focusStatusSoon(statusId: string): void {
  requestAnimationFrame(() => document.getElementById(statusId)?.focus());
}

function toNetworkNotices({
  blocked,
  isFocusMissing,
  isLayoutStale,
  staleSelection,
}: {
  blocked: NetworkLocalState["blocked"];
  isFocusMissing: boolean;
  isLayoutStale: boolean;
  staleSelection: GraphSceneSelection;
}): GraphNetworkNotice[] {
  const notices: GraphNetworkNotice[] = [];
  if (blocked !== null) notices.push({ kind: "blocked", name: blocked.name });
  if (isFocusMissing) notices.push({ kind: "focusMissing" });
  if (staleSelection !== null) {
    notices.push({ kind: "staleSelection", selection: staleSelection.kind });
  }
  if (isLayoutStale) notices.push({ kind: "layoutStale" });
  return notices;
}

"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { TreeOptions } from "../../model/workspace/graph-tree-scene";
import type { GraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphReaderKey } from "../../model/workspace/graph-workspace-request";
import type { GraphWorkspaceLayoutRestore } from "../../model/workspace/graph-workspace-signature";
import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphGenealogyBranch } from "./graph-genealogy-branches";
import type { GraphNetworkNavigation } from "./graph-network-scene";
import type { GraphPersonPanelState } from "./graph-person-scene";
import type { GraphSceneSelection, GraphSceneValue } from "./graph-scene-context";
import type { GraphTreePanelState } from "./graph-tree-scene";
import type { GraphGenealogyFocusRequest } from "./graph-tree-scene-context";
import type { GraphHiddenSelection } from "./graph-tree-status";
import type { GraphWorkspaceCanvasLayout } from "./graph-workspace-canvas-controls";
import type { WorkspaceWidthClass } from "./use-workspace-width-class";

import { GraphGenealogyScene } from "./graph-genealogy-scene";
import { GraphNetworkScene } from "./graph-network-scene";
import { GraphPersonScene } from "./graph-person-scene";
import { GraphTreeScene } from "./graph-tree-scene";
import { GraphWorkspaceMessage } from "./graph-workspace-message";
import { useGraphCounterText } from "./use-graph-counter-text";

export type GraphGenealogyNavigation = {
  activeBranchId: Nullable<string>;
  branches: readonly GraphGenealogyBranch[];
  focusRequest: Nullable<GraphGenealogyFocusRequest>;
  onBranch: (branchId: Nullable<string>) => void;
  onClearBranch: () => void;
};

type GraphSceneSectionProps = {
  actions: GraphWorkspaceState["actions"];
  bookId: string;
  genealogyNav: GraphGenealogyNavigation;
  hiddenSelection: Nullable<GraphHiddenSelection>;
  immersive: boolean;
  isError: boolean;
  isNotFound: boolean;
  layout: GraphWorkspaceCanvasLayout;
  layoutKey: string;
  networkNav: Nullable<GraphNetworkNavigation>;
  onClearSelection: () => void;
  onConfirmOverwrite: () => void;
  onDismissHiddenSelection: () => void;
  onDismissOverwrite: () => void;
  onMoreHop: (hop: number) => void;
  onRestoreFocus: () => void;
  onRetry: () => void;
  onRevealCharacter: (characterId: string) => void;
  onToggleBranch: (characterId: string) => void;
  onToggleImmersive: () => void;
  params: GraphWorkspaceParams;
  pendingOverwrite: boolean;
  personPanel: Nullable<GraphPersonPanelState>;
  placementKey: string;
  presentation: Nullable<GraphWorkspacePresentation>;
  reader: GraphReaderKey;
  relationshipActions: RelationshipActions;
  restore: Nullable<GraphWorkspaceLayoutRestore>;
  sceneKey: string;
  sceneValue: Nullable<GraphSceneValue>;
  selection: GraphSceneSelection;
  statusId: string;
  statusInline: boolean;
  treeOptions: TreeOptions;
  treePanel: Nullable<GraphTreePanelState>;
  widthClass: WorkspaceWidthClass;
};

export function GraphSceneSection(props: GraphSceneSectionProps) {
  const t = useTranslations("relationships.workspace");
  const counterText = useGraphCounterText(props.presentation);
  const announcement = props.isError ? "" : (counterText ?? t("states.loading"));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p
        aria-live="polite"
        className={cn(
          "pb-2 text-sm text-muted-foreground outline-none",
          (announcement === "" || props.statusInline) && "sr-only",
        )}
        id={props.statusId}
        tabIndex={-1}
      >
        {announcement}
      </p>
      <SceneContent {...props} />
    </div>
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
      <div aria-busy className="flex min-h-80 flex-1 flex-col">
        <Skeleton className="w-full flex-1 rounded-2xl" />
      </div>
    );
  }

  if (props.personPanel !== null && presentation.rootId !== null) {
    return (
      <GraphPersonScene
        {...props}
        personPanel={props.personPanel}
        presentation={presentation}
        rootId={presentation.rootId}
        sceneValue={sceneValue}
      />
    );
  }

  if (props.treePanel !== null && presentation.genealogy !== null) {
    return (
      <GraphGenealogyScene
        {...props}
        focusId={props.params.characterId}
        genealogy={presentation.genealogy}
        presentation={presentation}
        sceneValue={sceneValue}
        treePanel={props.treePanel}
      />
    );
  }

  if (props.treePanel !== null && presentation.tree !== null && presentation.rootId !== null) {
    return (
      <GraphTreeScene
        {...props}
        presentation={presentation}
        rootId={presentation.rootId}
        sceneValue={sceneValue}
        tree={presentation.tree}
        treePanel={props.treePanel}
      />
    );
  }

  if (props.networkNav !== null && presentation.network !== null) {
    return (
      <GraphNetworkScene
        {...props}
        network={presentation.network}
        networkNav={props.networkNav}
        presentation={presentation}
        sceneValue={sceneValue}
      />
    );
  }

  return null;
}

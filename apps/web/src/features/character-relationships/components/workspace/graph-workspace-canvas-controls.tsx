"use client";

import type { CharacterGraphViewport, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { Panel, useNodesInitialized, useReactFlow, useStore } from "@xyflow/react";
import {
  LocateFixed,
  MapIcon,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { use, useEffect, useRef } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { GraphCameraState } from "./graph-camera-state-context";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";

import { GENEALOGY_CAMERA } from "../../model/workspace/graph-genealogy-camera";
import { GraphCameraStateContext } from "./graph-camera-state-context";
import { GraphPersonSceneContext } from "./graph-person-scene-context";
import { GraphTreeSceneContext } from "./graph-tree-scene-context";
import { GRAPH_PERSON_CONTROLS_COVER, useGraphPersonCamera } from "./use-graph-person-camera";
import { useGraphTreeCamera } from "./use-graph-tree-camera";

const CANVAS_CONTROLS = {
  compactBelow: { horizontal: 440, vertical: 520 },
  durationMs: 250,
  fitMaxZoom: 1,
  fitPadding: 0.2,
  personButton:
    "relative after:absolute after:-inset-1 after:rounded-lg aria-pressed:bg-primary/10 aria-pressed:text-primary",
  personPanel: {
    horizontal:
      "flex items-center justify-center gap-0.5 rounded-2xl border border-border bg-card/90 p-1 shadow-soft backdrop-blur-sm",
    vertical:
      "flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/90 p-1 shadow-soft backdrop-blur-sm",
  },
  personSeparator: {
    horizontal: "h-6 w-px bg-border",
    vertical: "my-0.5 h-px w-6 bg-border",
  },
  reducedDurationMs: 0,
} as const;

export type GraphWorkspaceCanvasControlsProps = {
  immersive: boolean;
  layout: Nullable<GraphWorkspaceCanvasLayout>;
  onToggleImmersive: () => void;
  position: GraphPersonControlsPosition;
  rootId: Nullable<string>;
  sceneKey: string;
  viewport: Nullable<CharacterGraphViewport>;
};

export type GraphWorkspaceCanvasLayout = {
  canSave: boolean;
  hasSaved: boolean;
  isBusy: boolean;
  onReset: () => void;
  onSave: (snapshot: {
    positions: ReadonlyMap<string, RelationshipGraphPoint>;
    viewport: CharacterGraphViewport;
  }) => void;
};

export function GraphWorkspaceCanvasControls({
  immersive,
  layout,
  onToggleImmersive,
  position,
  rootId,
  sceneKey,
  viewport,
}: GraphWorkspaceCanvasControlsProps) {
  const t = useTranslations("relationships.workspace.canvas");
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const fittedScene = useRef<Nullable<string>>(null);
  const camera = useGraphPersonCamera();
  const treeCamera = useGraphTreeCamera();
  const personScene = use(GraphPersonSceneContext);
  const treeScene = use(GraphTreeSceneContext);
  const cameraStateRef = use(GraphCameraStateContext);
  const paneWidth = useStore((state) => state.width);
  const paneHeight = useStore((state) => state.height);
  const personCover =
    treeScene?.cover ?? personScene?.cover ?? GRAPH_PERSON_CONTROLS_COVER[position];
  const miniMap = treeScene?.miniMap ?? personScene?.miniMap ?? null;
  const duration = prefersReducedMotion
    ? CANVAS_CONTROLS.reducedDurationMs
    : CANVAS_CONTROLS.durationMs;

  function setCameraMode(mode: GraphCameraState["mode"]) {
    if (cameraStateRef !== null) cameraStateRef.current = { ...cameraStateRef.current, mode };
  }

  useEffect(() => {
    if (!initialized || fittedScene.current === sceneKey) return;
    fittedScene.current = sceneKey;
    if (cameraStateRef !== null) cameraStateRef.current = { mode: "manual", target: null };
    if (viewport !== null) {
      void flow.setViewport(viewport);
      return;
    }
    if (treeScene !== null && treeScene.genealogy !== null) {
      if (rootId === null) {
        treeCamera.fitAll({ cover: personCover, duration: 0 });
        if (cameraStateRef !== null)
          cameraStateRef.current = { ...cameraStateRef.current, mode: "auto" };
        return;
      }
      treeCamera.centerAt({ cover: personCover, id: rootId, zoom: GENEALOGY_CAMERA.initialZoom });
      return;
    }
    if (rootId === null) {
      void flow.fitView({
        maxZoom: CANVAS_CONTROLS.fitMaxZoom,
        padding: CANVAS_CONTROLS.fitPadding,
      });
      return;
    }
    if (treeScene !== null) {
      treeCamera.initialize({ cover: personCover, focusIds: treeScene.focusIds, rootId });
      return;
    }
    camera.initialize(personCover);
  }, [
    camera,
    cameraStateRef,
    flow,
    initialized,
    personCover,
    rootId,
    sceneKey,
    treeCamera,
    treeScene,
    viewport,
  ]);

  function fitAll() {
    if (treeScene !== null) {
      treeCamera.fitAll({ cover: personCover, duration });
      setCameraMode("auto");
      return;
    }
    camera.fitAll({ cover: personCover, duration });
  }

  function zoomBy(direction: "in" | "out") {
    if (cameraStateRef !== null) cameraStateRef.current = { mode: "manual", target: null };
    void (direction === "in" ? flow.zoomIn({ duration }) : flow.zoomOut({ duration }));
  }

  function centerRoot() {
    if (rootId === null) return;
    setCameraMode("manual");
    if (treeScene !== null) {
      treeCamera.center({ cover: personCover, duration, rootId });
      return;
    }
    camera.center({
      cover: personCover,
      duration,
      id: rootId,
      zoom: Math.max(flow.getZoom(), CANVAS_CONTROLS.fitMaxZoom),
    });
  }

  function saveLayout() {
    if (layout === null) return;
    layout.onSave({
      positions: new Map(flow.getNodes().map((node) => [node.id, node.position] as const)),
      viewport: flow.getViewport(),
    });
  }

  if (rootId !== null || treeScene !== null) {
    const orientation = position === "bottom-center" ? "horizontal" : "vertical";
    const tooltipSide = orientation === "horizontal" ? "top" : "left";
    const isCompact =
      treeScene !== null &&
      (orientation === "vertical"
        ? paneHeight < CANVAS_CONTROLS.compactBelow.vertical
        : paneWidth < CANVAS_CONTROLS.compactBelow.horizontal);
    const focusLabel = t(
      treeScene !== null && treeScene.genealogy !== null ? "focusSelected" : "center",
    );
    const resetLabel = layout === null ? "" : t(layout.hasSaved ? "reset" : "relayout");
    return (
      <Panel className={CANVAS_CONTROLS.personPanel[orientation]} position={position}>
        <PersonControl label={t("zoomIn")} onClick={() => zoomBy("in")} side={tooltipSide}>
          <ZoomIn aria-hidden />
        </PersonControl>
        <PersonControl label={t("zoomOut")} onClick={() => zoomBy("out")} side={tooltipSide}>
          <ZoomOut aria-hidden />
        </PersonControl>
        <PersonControl
          label={t(treeScene === null ? "fitAll" : "fitTree")}
          onClick={fitAll}
          side={tooltipSide}
        >
          <Scan aria-hidden />
        </PersonControl>
        {isCompact ? null : (
          <PersonControl
            disabled={rootId === null}
            label={focusLabel}
            onClick={centerRoot}
            side={tooltipSide}
          >
            <LocateFixed aria-hidden />
          </PersonControl>
        )}
        <PersonControl
          label={t(immersive ? "exitFullscreen" : "enterFullscreen")}
          onClick={onToggleImmersive}
          side={tooltipSide}
        >
          {immersive ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </PersonControl>
        {isCompact ? (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={t("more")}
                    className={CANVAS_CONTROLS.personButton}
                    size="icon-lg"
                    type="button"
                    variant="ghost"
                  >
                    <UiIcon name="more" size={18} />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide}>{t("more")}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" side={tooltipSide}>
              <DropdownMenuItem disabled={rootId === null} onSelect={centerRoot}>
                <LocateFixed aria-hidden />
                {focusLabel}
              </DropdownMenuItem>
              {miniMap === null ? null : (
                <DropdownMenuItem onSelect={miniMap.onToggle}>
                  <MapIcon aria-hidden />
                  {t(miniMap.isOpen ? "miniMap.hide" : "miniMap.show")}
                </DropdownMenuItem>
              )}
              {layout === null ? null : (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!layout.canSave || layout.isBusy}
                    onSelect={saveLayout}
                  >
                    <Save aria-hidden />
                    {t("save")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={layout.isBusy} onSelect={layout.onReset}>
                    <RotateCcw aria-hidden />
                    {resetLabel}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            {miniMap === null ? null : (
              <PersonControl
                label={t("miniMap.toggle")}
                onClick={miniMap.onToggle}
                pressed={miniMap.isOpen}
                side={tooltipSide}
              >
                <MapIcon aria-hidden />
              </PersonControl>
            )}
            {layout === null ? null : (
              <>
                <span aria-hidden className={CANVAS_CONTROLS.personSeparator[orientation]} />
                <PersonControl
                  disabled={!layout.canSave || layout.isBusy}
                  label={t("save")}
                  onClick={saveLayout}
                  side={tooltipSide}
                >
                  <Save aria-hidden />
                </PersonControl>
                <PersonControl
                  disabled={layout.isBusy}
                  label={resetLabel}
                  onClick={layout.onReset}
                  side={tooltipSide}
                >
                  <RotateCcw aria-hidden />
                </PersonControl>
              </>
            )}
          </>
        )}
      </Panel>
    );
  }

  return (
    <Panel className="flex flex-wrap items-center justify-end gap-1" position={position}>
      <Button
        aria-label={t("zoomOut")}
        onClick={() => void flow.zoomOut({ duration })}
        size="icon"
        type="button"
        variant="secondary"
      >
        <ZoomOut aria-hidden className="size-4" />
      </Button>
      <Button
        aria-label={t("zoomIn")}
        onClick={() => void flow.zoomIn({ duration })}
        size="icon"
        type="button"
        variant="secondary"
      >
        <ZoomIn aria-hidden className="size-4" />
      </Button>
      <Button
        aria-label={t("fit")}
        onClick={() =>
          void flow.fitView({
            duration,
            maxZoom: CANVAS_CONTROLS.fitMaxZoom,
            padding: CANVAS_CONTROLS.fitPadding,
          })
        }
        size="icon"
        type="button"
        variant="secondary"
      >
        <Scan aria-hidden className="size-4" />
      </Button>
      <Button
        aria-label={t(immersive ? "exitFullscreen" : "enterFullscreen")}
        aria-pressed={immersive}
        onClick={onToggleImmersive}
        size="icon"
        type="button"
        variant="secondary"
      >
        {immersive ? (
          <Minimize2 aria-hidden className="size-4" />
        ) : (
          <Maximize2 aria-hidden className="size-4" />
        )}
      </Button>
      {layout === null ? null : (
        <>
          <Button
            disabled={!layout.canSave || layout.isBusy}
            onClick={saveLayout}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t("save")}
          </Button>
          <Button
            disabled={layout.isBusy}
            onClick={layout.onReset}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t(layout.hasSaved ? "reset" : "relayout")}
          </Button>
        </>
      )}
    </Panel>
  );
}

function PersonControl({
  children,
  disabled = false,
  label,
  onClick,
  pressed,
  side,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  side: "left" | "top";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          aria-pressed={pressed}
          className={CANVAS_CONTROLS.personButton}
          disabled={disabled}
          onClick={onClick}
          size="icon-lg"
          type="button"
          variant="ghost"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

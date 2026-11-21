"use client";

import type { CharacterGraphViewport, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { Panel, useNodesInitialized, useReactFlow } from "@xyflow/react";
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

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";
import type { GraphPersonControlsPosition } from "./use-graph-person-camera";

import { GraphPersonSceneContext } from "./graph-person-scene-context";
import { GRAPH_PERSON_CONTROLS_COVER, useGraphPersonCamera } from "./use-graph-person-camera";

const CANVAS_CONTROLS = {
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
  const personScene = use(GraphPersonSceneContext);
  const personCover = personScene?.cover ?? GRAPH_PERSON_CONTROLS_COVER[position];
  const miniMap = personScene?.miniMap ?? null;
  const duration = prefersReducedMotion
    ? CANVAS_CONTROLS.reducedDurationMs
    : CANVAS_CONTROLS.durationMs;

  useEffect(() => {
    if (!initialized || fittedScene.current === sceneKey) return;
    fittedScene.current = sceneKey;
    if (viewport !== null) {
      void flow.setViewport(viewport);
      return;
    }
    if (rootId === null) {
      void flow.fitView({
        maxZoom: CANVAS_CONTROLS.fitMaxZoom,
        padding: CANVAS_CONTROLS.fitPadding,
      });
      return;
    }
    camera.initialize(personCover);
  }, [camera, flow, initialized, personCover, rootId, sceneKey, viewport]);

  function fitAll() {
    camera.fitAll({ cover: personCover, duration });
  }

  function centerRoot() {
    if (rootId === null) return;
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

  if (rootId !== null) {
    const orientation = position === "bottom-center" ? "horizontal" : "vertical";
    const tooltipSide = orientation === "horizontal" ? "top" : "left";
    return (
      <Panel className={CANVAS_CONTROLS.personPanel[orientation]} position={position}>
        <PersonControl
          label={t("zoomIn")}
          onClick={() => void flow.zoomIn({ duration })}
          side={tooltipSide}
        >
          <ZoomIn aria-hidden />
        </PersonControl>
        <PersonControl
          label={t("zoomOut")}
          onClick={() => void flow.zoomOut({ duration })}
          side={tooltipSide}
        >
          <ZoomOut aria-hidden />
        </PersonControl>
        <PersonControl label={t("fitAll")} onClick={fitAll} side={tooltipSide}>
          <Scan aria-hidden />
        </PersonControl>
        <PersonControl label={t("center")} onClick={centerRoot} side={tooltipSide}>
          <LocateFixed aria-hidden />
        </PersonControl>
        <PersonControl
          label={t(immersive ? "exitFullscreen" : "enterFullscreen")}
          onClick={onToggleImmersive}
          side={tooltipSide}
        >
          {immersive ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
        </PersonControl>
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
              label={t(layout.hasSaved ? "reset" : "relayout")}
              onClick={layout.onReset}
              side={tooltipSide}
            >
              <RotateCcw aria-hidden />
            </PersonControl>
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

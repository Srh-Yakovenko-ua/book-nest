"use client";

import type { CharacterGraphViewport, Nullable } from "@app/shared";

import { Panel, useNodesInitialized, useReactFlow } from "@xyflow/react";
import { Maximize2, Minimize2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import type { RelationshipGraphPoint } from "../../model/relationship-graph-layout";
import type { GraphSceneFlowEdge, GraphSceneFlowNode } from "./graph-scene-context";

const CANVAS_CONTROLS = {
  durationMs: 250,
  fitMaxZoom: 1,
  fitPadding: 0.2,
  reducedDurationMs: 0,
} as const;

export type GraphWorkspaceCanvasControlsProps = {
  immersive: boolean;
  layout: Nullable<GraphWorkspaceCanvasLayout>;
  onToggleImmersive: () => void;
  position: "top-left" | "top-right";
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
  sceneKey,
  viewport,
}: GraphWorkspaceCanvasControlsProps) {
  const t = useTranslations("relationships.workspace.canvas");
  const flow = useReactFlow<GraphSceneFlowNode, GraphSceneFlowEdge>();
  const initialized = useNodesInitialized();
  const prefersReducedMotion = useReducedMotion();
  const fittedScene = useRef<Nullable<string>>(null);
  const duration = prefersReducedMotion
    ? CANVAS_CONTROLS.reducedDurationMs
    : CANVAS_CONTROLS.durationMs;

  useEffect(() => {
    if (!initialized || fittedScene.current === sceneKey) return;
    fittedScene.current = sceneKey;
    if (viewport === null) {
      void flow.fitView({
        maxZoom: CANVAS_CONTROLS.fitMaxZoom,
        padding: CANVAS_CONTROLS.fitPadding,
      });
    } else {
      void flow.setViewport(viewport);
    }
  }, [flow, initialized, sceneKey, viewport]);

  function saveLayout() {
    if (layout === null) return;
    layout.onSave({
      positions: new Map(flow.getNodes().map((node) => [node.id, node.position] as const)),
      viewport: flow.getViewport(),
    });
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

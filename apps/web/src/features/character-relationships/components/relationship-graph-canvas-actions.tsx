"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { RelationshipGraphLayoutSnapshot } from "../api/use-relationship-graph-layout";
import type {
  RelationshipGraphFlowEdge,
  RelationshipGraphFlowNode,
} from "../model/relationship-graph-flow";
import type {
  RelationshipGraphPoint,
  RelationshipGraphPositionMap,
} from "../model/relationship-graph-layout";

const CANVAS_MOTION = {
  durationMs: 250,
  fitPadding: 0.2,
  reducedDurationMs: 0,
} as const;

export type RelationshipGraphCanvasLayout = {
  hasSavedLayout: boolean;
  isResetting: boolean;
  isSaving: boolean;
  onReset: () => void;
  onSave: (snapshot: RelationshipGraphLayoutSnapshot) => void;
};

type RelationshipGraphCanvasActionsProps = {
  autoPositions: RelationshipGraphPositionMap;
  layout: RelationshipGraphCanvasLayout;
  layoutVersion: string;
};

export function RelationshipGraphCanvasActions({
  autoPositions,
  layout,
  layoutVersion,
}: RelationshipGraphCanvasActionsProps) {
  const t = useTranslations("relationships.graph");
  const prefersReducedMotion = useReducedMotion();
  const flow = useReactFlow<RelationshipGraphFlowNode, RelationshipGraphFlowEdge>();
  const duration = prefersReducedMotion
    ? CANVAS_MOTION.reducedDurationMs
    : CANVAS_MOTION.durationMs;

  function fitGraph() {
    void flow.fitView({ duration, padding: CANVAS_MOTION.fitPadding });
  }

  function saveLayout() {
    layout.onSave({
      layoutVersion,
      positions: Object.fromEntries(
        flow.getNodes().map((node) => [node.id, roundPoint(node.position)] as const),
      ),
      viewport: flow.getViewport(),
    });
  }

  function resetLayout() {
    flow.setNodes((current) =>
      current.map((node) => ({ ...node, position: autoPositions[node.id] ?? node.position })),
    );
    fitGraph();
    if (layout.hasSavedLayout) layout.onReset();
  }

  return (
    <>
      <Panel className="flex max-w-2/3 flex-wrap gap-2" position="bottom-left">
        <Button disabled={layout.isSaving} onClick={saveLayout} size="sm" variant="secondary">
          <UiIcon name="bookmark" size={14} />
          {layout.isSaving ? t("layout.saving") : t("layout.save")}
        </Button>
        <Button disabled={layout.isResetting} onClick={resetLayout} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {t("layout.reset")}
        </Button>
      </Panel>
      <Panel position="top-right">
        <div aria-label={t("zoom.label")} className="flex flex-col gap-1" role="group">
          <Button
            aria-label={t("zoom.in")}
            onClick={() => void flow.zoomIn({ duration })}
            size="icon"
            variant="secondary"
          >
            <UiIcon name="plus" size={16} />
          </Button>
          <Button
            aria-label={t("zoom.out")}
            onClick={() => void flow.zoomOut({ duration })}
            size="icon"
            variant="secondary"
          >
            <UiIcon name="minus" size={16} />
          </Button>
          <Button aria-label={t("zoom.fit")} onClick={fitGraph} size="icon" variant="secondary">
            <UiIcon name="target" size={16} />
          </Button>
        </div>
      </Panel>
    </>
  );
}

function roundPoint(point: RelationshipGraphPoint): RelationshipGraphPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

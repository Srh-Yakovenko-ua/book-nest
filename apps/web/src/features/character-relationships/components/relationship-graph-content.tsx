"use client";

import type { CharacterGraphLayoutView, CharacterGraphView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { assertNever } from "@/lib/assert-never";

import type { useRelationshipGraph } from "../api/use-relationship-graph";
import type { useRelationshipGraphLayout } from "../api/use-relationship-graph-layout";
import type { RelationshipGraphCanvasProps } from "./relationship-graph-canvas";

import { RelationshipGraphCanvasLazy } from "./relationship-graph-canvas-lazy";
import { RelationshipsErrorState } from "./relationships-error-state";

const GRAPH_FRAME =
  "relative h-120 w-full overflow-hidden rounded-xl border border-border bg-card sm:h-144";

type ContentViewInput = Pick<RelationshipGraphContentProps, "graph" | "hasFilters" | "layout">;

type RelationshipGraphContentProps = {
  canvas: Omit<RelationshipGraphCanvasProps, "graph" | "savedLayout">;
  canvasKey: string;
  graph: ReturnType<typeof useRelationshipGraph>;
  hasFilters: boolean;
  layout: ReturnType<typeof useRelationshipGraphLayout>["layout"];
  onClearFilters: () => void;
  preview: ReactNode;
};

type RelationshipGraphContentView =
  | { graph: CharacterGraphView; kind: "ready"; savedLayout: Nullable<CharacterGraphLayoutView> }
  | { kind: "empty" }
  | { kind: "error" }
  | { kind: "filteredEmpty" }
  | { kind: "loading" };

export function RelationshipGraphContent({
  canvas,
  canvasKey,
  graph,
  hasFilters,
  layout,
  onClearFilters,
  preview,
}: RelationshipGraphContentProps) {
  const t = useTranslations("relationships.graph");
  const view = toContentView({ graph, hasFilters, layout });

  switch (view.kind) {
    case "empty":
      return (
        <EmptyState
          state={{ desc: t("empty.description"), illu: "empty-notes", title: t("empty.title") }}
        />
      );
    case "error":
      return (
        <RelationshipsErrorState
          description={t("error.description")}
          onRetry={() => void graph.refetch()}
          retryLabel={t("error.retry")}
          title={t("error.title")}
        />
      );
    case "filteredEmpty":
      return (
        <EmptyState
          onPrimary={onClearFilters}
          state={{
            desc: t("filteredEmpty.description"),
            illu: "empty-search",
            primary: { icon: "x", label: t("filteredEmpty.reset") },
            title: t("filteredEmpty.title"),
          }}
        />
      );
    case "loading":
      return (
        <div aria-busy className={GRAPH_FRAME} role="status">
          <Skeleton className="size-full rounded-none" />
          <span className="sr-only">{t("loading")}</span>
        </div>
      );
    case "ready":
      return (
        <div aria-label={t("canvasLabel")} className={GRAPH_FRAME} role="group">
          <RelationshipGraphCanvasLazy
            {...canvas}
            graph={view.graph}
            key={`${view.graph.graphVersion}:${view.graph.clusterBy ?? ""}:${canvasKey}`}
            savedLayout={view.savedLayout}
          />
          {preview}
        </div>
      );
    default:
      return assertNever(view);
  }
}

function toContentView({
  graph,
  hasFilters,
  layout,
}: ContentViewInput): RelationshipGraphContentView {
  if (graph.isError) return { kind: "error" };
  if (graph.data === undefined || layout.isPending) return { kind: "loading" };
  if (graph.data.edges.length === 0) return { kind: hasFilters ? "filteredEmpty" : "empty" };
  return { graph: graph.data, kind: "ready", savedLayout: layout.data ?? null };
}

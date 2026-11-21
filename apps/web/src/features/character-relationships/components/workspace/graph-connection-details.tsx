"use client";

import type { CharacterGraphEdgeView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { RelationshipScope } from "../../model/relationship-scope";
import type { RelationshipDetailsLayout } from "../relationship-details-content";

import { RelationshipDetailsContent } from "../relationship-details-content";
import { useGraphEdgeLabel } from "./use-graph-edge-label";

type GraphConnectionDetailsProps = {
  actions: RelationshipActions;
  contentKey: string;
  edges: readonly CharacterGraphEdgeView[];
  layout?: RelationshipDetailsLayout;
  names: { source: string; target: string };
  renderEdge?: (edge: CharacterGraphEdgeView, index: number) => ReactNode;
  scope: RelationshipScope;
};

export function GraphConnectionDetails({
  actions,
  contentKey,
  edges,
  layout = "dialog",
  names,
  renderEdge,
  scope,
}: GraphConnectionDetailsProps) {
  const t = useTranslations("relationships.workspace.panel.connection");
  const toLabel = useGraphEdgeLabel();
  const [selectedEdgeId, setSelectedEdgeId] = useState<Nullable<string>>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const lastOpenedEdgeId = useRef<Nullable<string>>(null);
  const itemIdPrefix = useId();

  useEffect(() => {
    if (selectedEdgeId !== null) {
      backButton.current?.focus();
      return;
    }
    const opened = lastOpenedEdgeId.current;
    if (opened !== null) document.getElementById(`${itemIdPrefix}-${opened}`)?.focus();
  }, [itemIdPrefix, selectedEdgeId]);
  const [single] = edges;
  const activeEdgeId = edges.length === 1 && single !== undefined ? single.id : selectedEdgeId;

  if (activeEdgeId !== null) {
    const activeIndex = edges.findIndex((edge) => edge.id === activeEdgeId);
    const activeEdge = edges[activeIndex];
    return (
      <>
        {edges.length > 1 ? (
          <Button
            className="self-start"
            onClick={() => setSelectedEdgeId(null)}
            ref={backButton}
            size="sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="arrow-left" size={14} />
            {t("back")}
          </Button>
        ) : null}
        {edges.length > 1 && renderEdge !== undefined && activeEdge !== undefined ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
            {renderEdge(activeEdge, activeIndex)}
          </div>
        ) : null}
        <RelationshipDetailsContent
          actions={actions}
          key={`${contentKey}:${activeEdgeId}`}
          layout={layout}
          relationshipId={activeEdgeId}
          scope={scope}
        />
      </>
    );
  }

  return (
    <section aria-labelledby="graph-connection-group" className="flex flex-col gap-2">
      <h3
        className={layout === "panel" ? "sr-only" : "text-sm font-medium"}
        id="graph-connection-group"
      >
        {t("group", names)}
      </h3>
      <ul className="flex flex-col gap-1">
        {edges.map((edge, index) => (
          <li key={edge.id}>
            <Button
              className="h-auto w-full justify-between gap-2 py-2 text-left"
              id={`${itemIdPrefix}-${edge.id}`}
              onClick={() => {
                lastOpenedEdgeId.current = edge.id;
                setSelectedEdgeId(edge.id);
              }}
              type="button"
              variant="ghost"
            >
              {renderEdge === undefined ? (
                <>
                  <span className="min-w-0 truncate">{toLabel(edge)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t("item", { index: index + 1 })}
                  </span>
                </>
              ) : (
                renderEdge(edge, index)
              )}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import type { CharacterGraphEdgeView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { RelationshipActions } from "../../model/relationship-adapter";
import type { RelationshipScope } from "../../model/relationship-scope";

import { RelationshipDetailsContent } from "../relationship-details-content";
import { useGraphEdgeLabel } from "./use-graph-edge-label";

type GraphConnectionDetailsProps = {
  actions: RelationshipActions;
  contentKey: string;
  edges: readonly CharacterGraphEdgeView[];
  names: { source: string; target: string };
  scope: RelationshipScope;
};

export function GraphConnectionDetails({
  actions,
  contentKey,
  edges,
  names,
  scope,
}: GraphConnectionDetailsProps) {
  const t = useTranslations("relationships.workspace.panel.connection");
  const toLabel = useGraphEdgeLabel();
  const [selectedEdgeId, setSelectedEdgeId] = useState<Nullable<string>>(null);
  const [single] = edges;
  const activeEdgeId = edges.length === 1 && single !== undefined ? single.id : selectedEdgeId;

  if (activeEdgeId !== null) {
    return (
      <>
        {edges.length > 1 ? (
          <Button
            className="self-start"
            onClick={() => setSelectedEdgeId(null)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <UiIcon name="arrow-left" size={14} />
            {t("back")}
          </Button>
        ) : null}
        <RelationshipDetailsContent
          actions={actions}
          key={`${contentKey}:${activeEdgeId}`}
          relationshipId={activeEdgeId}
          scope={scope}
        />
      </>
    );
  }

  return (
    <section aria-labelledby="graph-connection-group" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium" id="graph-connection-group">
        {t("group", names)}
      </h3>
      <ul className="flex flex-col gap-1">
        {edges.map((edge, index) => (
          <li key={edge.id}>
            <Button
              className="h-auto w-full justify-between gap-2 py-2 text-left"
              onClick={() => setSelectedEdgeId(edge.id)}
              type="button"
              variant="ghost"
            >
              <span className="min-w-0 truncate">{toLabel(edge)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("item", { index: index + 1 })}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

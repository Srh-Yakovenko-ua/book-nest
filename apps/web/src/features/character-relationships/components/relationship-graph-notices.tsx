"use client";

import {
  CHARACTER_GRAPH_EDGE_LIMIT,
  CHARACTER_GRAPH_NODE_LIMIT,
  type CharacterGraphHiddenContentView,
} from "@app/shared";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function RelationshipGraphNotices({
  hiddenContent,
}: {
  hiddenContent: CharacterGraphHiddenContentView;
}) {
  const t = useTranslations("relationships.graph.notices");
  if (!hiddenContent.truncated && !hiddenContent.hasLockedEdges) return null;

  return (
    <div className="flex flex-col gap-2">
      {hiddenContent.truncated ? (
        <Alert>
          <UiIcon name="info" />
          <AlertDescription>
            {t("truncated", {
              edges: CHARACTER_GRAPH_EDGE_LIMIT,
              nodes: CHARACTER_GRAPH_NODE_LIMIT,
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {hiddenContent.hasLockedEdges ? (
        <Alert>
          <UiIcon name="eye-off" />
          <AlertDescription>{t("locked")}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

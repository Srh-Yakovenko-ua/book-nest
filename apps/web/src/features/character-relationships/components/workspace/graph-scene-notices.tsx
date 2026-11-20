"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";

import { GraphSceneStatus } from "./graph-scene-status";

type GraphSceneNoticesProps = {
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  onMoreClusters: () => void;
  onMoreHop: Nullable<(hop: number) => void>;
  onResetFilters: () => void;
  pendingOverwrite: boolean;
  presentation: GraphWorkspacePresentation;
};

export function GraphSceneNotices({
  onConfirmOverwrite,
  onDismissOverwrite,
  onMoreClusters,
  onMoreHop,
  onResetFilters,
  pendingOverwrite,
  presentation,
}: GraphSceneNoticesProps) {
  const t = useTranslations("relationships.workspace");
  const moreHops = onMoreHop === null ? [] : presentation.moreHops;

  return (
    <>
      <GraphSceneStatus
        empty={presentation.empty}
        notices={presentation.notices}
        onResetFilters={onResetFilters}
      />
      {moreHops.length > 0 || presentation.hasMoreClusters ? (
        <div className="flex flex-wrap gap-2">
          {moreHops.map((hop) => (
            <Button
              key={hop}
              onClick={() => onMoreHop?.(hop)}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("more.ring", { hop })}
            </Button>
          ))}
          {presentation.hasMoreClusters ? (
            <Button onClick={onMoreClusters} size="sm" type="button" variant="outline">
              {t("more.clusters")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {pendingOverwrite ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm"
          role="alert"
        >
          <span>{t("canvas.overwrite")}</span>
          <Button onClick={onConfirmOverwrite} size="sm" type="button">
            {t("canvas.confirmOverwrite")}
          </Button>
          <Button onClick={onDismissOverwrite} size="sm" type="button" variant="ghost">
            {t("canvas.cancelOverwrite")}
          </Button>
        </div>
      ) : null}
    </>
  );
}

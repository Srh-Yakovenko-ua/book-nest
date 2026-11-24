"use client";

import type { Nullable } from "@app/shared";

import { ArrowLeft, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { TruncatedText } from "@/components/truncated-text";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

import type { NetworkScene } from "../../model/workspace/graph-network-scene";
import type { NetworkGrouping } from "../../model/workspace/graph-workspace-params";

import { NETWORK_SCENE_BUDGET } from "../../model/workspace/graph-network-scene";
import { useNetworkBucketLabel } from "./use-network-bucket-label";

const FOCUS_BAR = {
  hitArea: "relative after:absolute after:inset-x-0 after:-inset-y-2",
} as const;

type GraphNetworkFocusBarProps = {
  grouping: NetworkGrouping;
  onFocusGroup: (bucketId: Nullable<string>) => void;
  onMoreClusters: () => void;
  onMoreMembers: () => void;
  onOpenMembers: () => void;
  scene: NetworkScene;
};

export function GraphNetworkFocusBar({
  grouping,
  onFocusGroup,
  onMoreClusters,
  onMoreMembers,
  onOpenMembers,
  scene,
}: GraphNetworkFocusBarProps) {
  const t = useTranslations("relationships.workspace.network");
  const toLabel = useNetworkBucketLabel();

  if (scene.kind === "overview") {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {t(`overview.hint.${grouping}`)} {t("overview.links", { count: scene.links.length })}
        </p>
        {scene.hasMoreBuckets ? (
          <Button
            className={FOCUS_BAR.hitArea}
            onClick={onMoreClusters}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden />
            {t("overview.moreGroups", { count: scene.hiddenBucketCount })}
          </Button>
        ) : null}
      </div>
    );
  }

  const groupLabel = toLabel(scene.bucket.label);
  const total = scene.bucket.memberIds.length;
  const nextPage = Math.min(NETWORK_SCENE_BUDGET.focusMembers, scene.hiddenMemberCount);

  return (
    <div className="flex flex-col gap-2">
      <Breadcrumb aria-label={t("focus.breadcrumb")}>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <button
                className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-sm px-2 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onFocusGroup(null)}
                type="button"
              >
                <ArrowLeft aria-hidden className="size-4" />
                {t("focus.overview")}
              </button>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem className="min-w-0">
            <h2 className="flex min-w-0 text-sm">
              <BreadcrumbPage className="flex min-w-0 font-semibold">
                <TruncatedText text={groupLabel} />
              </BreadcrumbPage>
            </h2>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex flex-wrap gap-x-3 text-sm text-muted-foreground">
          <span>{t("focus.shown", { shown: scene.memberIds.length, total })}</span>
          {scene.hiddenNeighborCount > 0 ? (
            <span>{t("focus.hiddenNeighbors", { count: scene.hiddenNeighborCount })}</span>
          ) : null}
        </p>
        {scene.hasMoreMembers ? (
          <Button
            className={FOCUS_BAR.hitArea}
            onClick={onMoreMembers}
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus aria-hidden />
            {t("focus.moreMembers", { count: nextPage })}
          </Button>
        ) : null}
        <Button
          className={FOCUS_BAR.hitArea}
          onClick={onOpenMembers}
          size="sm"
          type="button"
          variant="outline"
        >
          <Users aria-hidden />
          {t("focus.allMembers", { count: total })}
        </Button>
      </div>
    </div>
  );
}

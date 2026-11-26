"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { assertNever } from "@/lib/assert-never";

import type { GraphWorkspacePresentation } from "../../model/workspace/graph-workspace-presentation";
import type { GraphSceneSelectionKind } from "./graph-scene-context";

import { GraphSceneStatus } from "./graph-scene-status";

const NETWORK_NOTICES = {
  actionable: ["importanceUnknown"],
  row: "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm",
} as const;

export type GraphNetworkNotice =
  | { kind: "blocked"; name: string }
  | { kind: "focusMissing" }
  | { kind: "layoutStale" }
  | { kind: "staleSelection"; selection: GraphSceneSelectionKind };

export type GraphNetworkNoticeKind = GraphNetworkNotice["kind"];

type GraphNetworkNoticesProps = {
  canUseGroupGrouping: boolean;
  notices: readonly GraphNetworkNotice[];
  onConfirmOverwrite: () => void;
  onDismiss: (kind: GraphNetworkNoticeKind) => void;
  onDismissOverwrite: () => void;
  onResetBlocked: () => void;
  onResetFilters: () => void;
  onUseGroupGrouping: () => void;
  pendingOverwrite: boolean;
  presentation: GraphWorkspacePresentation;
};

export function GraphNetworkNotices({
  canUseGroupGrouping,
  notices,
  onConfirmOverwrite,
  onDismiss,
  onDismissOverwrite,
  onResetBlocked,
  onResetFilters,
  onUseGroupGrouping,
  pendingOverwrite,
  presentation,
}: GraphNetworkNoticesProps) {
  const t = useTranslations("relationships.workspace");
  const plainNotices = presentation.notices.filter(
    (notice) => !NETWORK_NOTICES.actionable.some((actionable) => actionable === notice),
  );
  const isImportanceUnknown = presentation.notices.includes("importanceUnknown");

  return (
    <div className="flex flex-col gap-2">
      <GraphSceneStatus
        empty={presentation.empty}
        notices={plainNotices}
        onResetFilters={onResetFilters}
      />
      {isImportanceUnknown ? (
        <div className={NETWORK_NOTICES.row}>
          <span className="min-w-0 flex-1">{t("notices.importanceUnknown")}</span>
          {canUseGroupGrouping ? (
            <Button onClick={onUseGroupGrouping} size="sm" type="button" variant="outline">
              {t("network.notices.useGroups")}
            </Button>
          ) : null}
        </div>
      ) : null}
      <div aria-live="polite" className="flex flex-col gap-2">
        {notices.map((notice) => (
          <div className={NETWORK_NOTICES.row} key={notice.kind}>
            <span className="min-w-0 flex-1">
              <NoticeText notice={notice} />
            </span>
            {notice.kind === "blocked" ? (
              <Button
                aria-label={t("network.notices.resetBlocked", { name: notice.name })}
                autoFocus
                onClick={onResetBlocked}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("filters.reset")}
              </Button>
            ) : null}
            <Button
              aria-label={t("network.notices.dismiss")}
              onClick={() => onDismiss(notice.kind)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      {pendingOverwrite ? (
        <div className={NETWORK_NOTICES.row} role="alert">
          <span>{t("canvas.overwrite")}</span>
          <Button onClick={onConfirmOverwrite} size="sm" type="button">
            {t("canvas.confirmOverwrite")}
          </Button>
          <Button onClick={onDismissOverwrite} size="sm" type="button" variant="ghost">
            {t("canvas.cancelOverwrite")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function NoticeText({ notice }: { notice: GraphNetworkNotice }) {
  const t = useTranslations("relationships.workspace.network.notices");
  switch (notice.kind) {
    case "blocked":
      return t("blocked", { name: notice.name });
    case "focusMissing":
      return t("focusMissing");
    case "layoutStale":
      return t("layoutStale");
    case "staleSelection":
      return t(`staleSelection.${notice.selection}`);
    default:
      return assertNever(notice);
  }
}

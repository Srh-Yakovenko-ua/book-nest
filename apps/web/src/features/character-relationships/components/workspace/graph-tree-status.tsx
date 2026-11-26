"use client";

import type { Nullable } from "@app/shared";

import { BOOK_FAMILY_TREE } from "@app/shared";
import { CircleAlert, EyeOff, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { GraphPresentationNotice } from "../../model/workspace/graph-workspace-presentation";

const WARNING_NOTICES = [
  "genealogyTruncated",
  "treeConflicts",
  "treeTruncated",
  "truncated",
] as const;

export type GraphHiddenSelection = {
  id: string;
  name: string;
  reason: "collapsed" | "filtered";
};

export type GraphTreeCollapsedCounts = {
  branches: number;
  hidden: number;
};

type GraphTreeStatusProps = {
  collapsed: Nullable<GraphTreeCollapsedCounts>;
  hiddenSelection: Nullable<GraphHiddenSelection>;
  immersive: boolean;
  notices: readonly GraphPresentationNotice[];
  onConfirmOverwrite: () => void;
  onDismissHiddenSelection: () => void;
  onDismissOverwrite: () => void;
  onResetLinks: () => void;
  onRevealSelection: (characterId: string) => void;
  pendingOverwrite: boolean;
};

export function GraphTreeStatus({
  collapsed,
  hiddenSelection,
  immersive,
  notices,
  onConfirmOverwrite,
  onDismissHiddenSelection,
  onDismissOverwrite,
  onResetLinks,
  onRevealSelection,
  pendingOverwrite,
}: GraphTreeStatusProps) {
  const t = useTranslations("relationships.workspace");
  const warnings = notices.filter((notice) => isWarning(notice));
  const infos = immersive ? [] : notices.filter((notice) => !isWarning(notice));
  const values = {
    branches: collapsed?.branches ?? 0,
    hidden: collapsed?.hidden ?? 0,
    limit: BOOK_FAMILY_TREE.nodeLimit,
  };

  return (
    <>
      <div className="flex flex-col gap-1.5 empty:hidden" role="status">
        {warnings.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5">
            {warnings.map((notice) => (
              <li
                className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground"
                key={notice}
              >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{t(`notices.${notice}`, values)}</span>
              </li>
            ))}
          </ul>
        )}
        {hiddenSelection === null ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-sm">
            <EyeOff aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              {t(`tree.hiddenSelection.${hiddenSelection.reason}`, { name: hiddenSelection.name })}
            </span>
            <Button
              onClick={() =>
                hiddenSelection.reason === "filtered"
                  ? onResetLinks()
                  : onRevealSelection(hiddenSelection.id)
              }
              size="sm"
              type="button"
              variant="outline"
            >
              {t(`tree.hiddenSelection.action.${hiddenSelection.reason}`)}
            </Button>
            <Button
              aria-label={t("tree.hiddenSelection.dismiss")}
              onClick={onDismissHiddenSelection}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <UiIcon name="x" size={14} />
            </Button>
          </div>
        )}
        {infos.length === 0 ? null : (
          <ul className="flex flex-col gap-0.5">
            {infos.map((notice) => (
              <li className="flex items-start gap-1.5 text-xs text-muted-foreground" key={notice}>
                <Info aria-hidden className="mt-px size-3.5 shrink-0" />
                <span>{t(`notices.${notice}`, values)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
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

function isWarning(notice: GraphPresentationNotice): boolean {
  return WARNING_NOTICES.some((warning) => warning === notice);
}

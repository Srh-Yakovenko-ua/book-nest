"use client";

import { CircleAlert, Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { GraphPresentationNotice } from "../../model/workspace/graph-workspace-presentation";

const WARNING_NOTICES = ["treeConflicts", "treeTruncated", "truncated"] as const;

type GraphTreeStatusProps = {
  notices: readonly GraphPresentationNotice[];
  onConfirmOverwrite: () => void;
  onDismissOverwrite: () => void;
  pendingOverwrite: boolean;
};

export function GraphTreeStatus({
  notices,
  onConfirmOverwrite,
  onDismissOverwrite,
  pendingOverwrite,
}: GraphTreeStatusProps) {
  const t = useTranslations("relationships.workspace");

  return (
    <>
      <div className="empty:hidden" role="status">
        {notices.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5">
            {notices.map((notice) => {
              const isWarning = WARNING_NOTICES.some((warning) => warning === notice);
              const Icon = isWarning ? CircleAlert : Info;
              return (
                <li
                  className={cn(
                    "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                    isWarning
                      ? "border-warning/40 bg-warning/10 text-foreground"
                      : "border-border bg-muted/50 text-muted-foreground",
                  )}
                  key={notice}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      isWarning ? "text-warning" : "text-muted-foreground",
                    )}
                  />
                  <span>{t(`notices.${notice}`)}</span>
                </li>
              );
            })}
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

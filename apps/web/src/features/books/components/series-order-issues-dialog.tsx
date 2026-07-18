"use client";

import type { SeriesOrderActionCode, SeriesOrderIssueView } from "@app/shared";

import { SERIES_ORDER_ISSUES_LIMIT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { useSeriesOrderIssues } from "../api/use-series-order-check";
import { SeriesOrderIssueCard } from "./series-order-issue-card";

type SeriesOrderIssuesDialogProps = {
  onAction: (input: {
    code: SeriesOrderActionCode;
    issue: SeriesOrderIssueView;
    queueVersion: string;
  }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingFingerprint: null | string;
};

const SKELETON_COUNT = 3;

export function SeriesOrderIssuesDialog({
  onAction,
  onOpenChange,
  open,
  pendingFingerprint,
}: SeriesOrderIssuesDialogProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const issues = useSeriesOrderIssues({ enabled: open, limit: SERIES_ORDER_ISSUES_LIMIT_MAX });
  const view = issues.data;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("allIssues.title")}</DialogTitle>
          <DialogDescription>{t("allIssues.description")}</DialogDescription>
        </DialogHeader>

        {issues.isPending ? (
          <div aria-label={t("loading")} className="flex flex-col gap-3" role="status">
            {Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <Skeleton className="h-64 w-full rounded-xl" key={index} />
            ))}
          </div>
        ) : issues.isError || view === undefined ? (
          <div className="flex flex-col items-start gap-3" role="alert">
            <p className="text-sm text-destructive">{t("error.load")}</p>
            <Button onClick={() => void issues.refetch()} size="sm" variant="secondary">
              {t("actions.retry")}
            </Button>
          </div>
        ) : view.items.length === 0 ? (
          <div className="flex flex-col gap-1 py-4 text-center">
            <p className="font-heading text-base font-semibold text-ink">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {view.items.map((issue) => (
              <li key={issue.fingerprint}>
                <SeriesOrderIssueCard
                  issue={issue}
                  onAction={(code) => onAction({ code, issue, queueVersion: view.queueVersion })}
                  pending={pendingFingerprint === issue.fingerprint}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import type { SeriesOrderActionCode, SeriesOrderIssueView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { SeriesOrderErrorKey, SeriesOrderFixTarget } from "../model/series-order-check";

import {
  useDisableSeriesOrderCheck,
  useIgnoreSeriesOrderIssue,
  useSeriesOrderIssues,
} from "../api/use-series-order-check";
import {
  isSeriesOrderFixStrategy,
  isSeriesOrderStaleError,
  SERIES_ORDER_SIDEBAR_LIMIT,
  toSeriesOrderErrorKey,
} from "../model/series-order-check";
import { SeriesOrderCheckSkeleton } from "./series-order-check-skeleton";
import { SeriesOrderDisableDialog } from "./series-order-disable-dialog";
import { SeriesOrderFixPreviewDialog } from "./series-order-fix-preview-dialog";
import { SeriesOrderIssueCard } from "./series-order-issue-card";
import { SeriesOrderIssuesDialog } from "./series-order-issues-dialog";
import { WantToBuyDialog } from "./want-to-buy-dialog";

type DisableTarget = {
  id: string;
  title: string;
};

export function SeriesOrderCheckBlock() {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const tError = useTranslations("readingQueue.seriesOrderCheck.error");

  const issues = useSeriesOrderIssues({ limit: SERIES_ORDER_SIDEBAR_LIMIT });
  const ignoreIssue = useIgnoreSeriesOrderIssue();
  const disableSeries = useDisableSeriesOrderCheck();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const [allIssuesOpen, setAllIssuesOpen] = useState(false);
  const [fixTarget, setFixTarget] = useState<null | SeriesOrderFixTarget>(null);
  const [disableTarget, setDisableTarget] = useState<DisableTarget | null>(null);
  const [wishlistBookId, setWishlistBookId] = useState<null | string>(null);
  const [pendingFingerprint, setPendingFingerprint] = useState<null | string>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [focusHeadingOnClose, setFocusHeadingOnClose] = useState(false);

  const view = issues.data;

  function handleMutationError(error: unknown) {
    toast.error(tError(toSeriesOrderErrorKey(error)));
  }

  function handleIgnore(issue: SeriesOrderIssueView) {
    setPendingFingerprint(issue.fingerprint);
    ignoreIssue.mutate(issue.fingerprint, {
      onError: handleMutationError,
      onSettled: () => setPendingFingerprint(null),
      onSuccess: () => {
        setStatusMessage(t("success.ignored"));
        toast.success(t("success.ignored"));
      },
    });
  }

  function handleDisable(target: DisableTarget) {
    disableSeries.mutate(target.id, {
      onError: handleMutationError,
      onSuccess: () => {
        setDisableTarget(null);
        setStatusMessage(t("success.disabled"));
        toast.success(t("success.disabled"));
      },
    });
  }

  function handleAction({
    code,
    issue,
    queueVersion,
  }: {
    code: SeriesOrderActionCode;
    issue: SeriesOrderIssueView;
    queueVersion: string;
  }) {
    if (isSeriesOrderFixStrategy(code)) {
      setFocusHeadingOnClose(false);
      setFixTarget({
        fingerprint: issue.fingerprint,
        problemType: issue.problemType,
        queueVersion,
        seriesTitle: issue.series.title,
        strategy: code,
      });
      return;
    }
    if (code === "ADD_PREVIOUS_TO_WISHLIST") {
      setWishlistBookId(issue.previousBook?.id ?? null);
      return;
    }
    if (code === "IGNORE_ISSUE") {
      handleIgnore(issue);
      return;
    }
    if (code === "DISABLE_SERIES_CHECK") {
      setDisableTarget({ id: issue.series.id, title: issue.series.title });
    }
  }

  function handleFixSuccess() {
    setFixTarget(null);
    setFocusHeadingOnClose(true);
    setStatusMessage(t("success.fixed"));
    toast.success(t("success.fixed"));
  }

  function handleFixError(key: SeriesOrderErrorKey) {
    toast.error(tError(key));
    if (isSeriesOrderStaleError(key)) setFixTarget(null);
  }

  if (issues.isPending) return <SeriesOrderCheckSkeleton />;

  if (issues.isError || view === undefined) {
    return (
      <div className="flex flex-col items-start gap-2.5 rounded-xl border border-border bg-card p-4">
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
          <UiIcon name="alert-circle" size={16} />
          {t("error.load")}
        </p>
        <Button onClick={() => void issues.refetch()} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {t("actions.retry")}
        </Button>
      </div>
    );
  }

  if (view.items.length === 0) return null;

  return (
    <section aria-labelledby="series-order-check-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <h2
            className="font-heading text-sm font-semibold text-ink"
            id="series-order-check-heading"
            ref={headingRef}
            tabIndex={-1}
          >
            {t("title")}
          </h2>
          <span
            aria-label={t("countLabel", { count: view.total })}
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-foreground tabular-nums"
          >
            {view.total}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="flex flex-col gap-3">
        {view.items.map((issue) => (
          <li key={issue.fingerprint}>
            <SeriesOrderIssueCard
              issue={issue}
              onAction={(code) => handleAction({ code, issue, queueVersion: view.queueVersion })}
              pending={pendingFingerprint === issue.fingerprint}
            />
          </li>
        ))}
      </ul>

      {view.total > view.items.length ? (
        <Button
          className="self-start"
          onClick={() => setAllIssuesOpen(true)}
          size="sm"
          variant="ghost"
        >
          {t("viewAll")}
          <UiIcon name="arrow-right" size={14} />
        </Button>
      ) : null}

      <p aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </p>

      <SeriesOrderIssuesDialog
        onAction={handleAction}
        onOpenChange={setAllIssuesOpen}
        open={allIssuesOpen}
        pendingFingerprint={pendingFingerprint}
      />

      <SeriesOrderFixPreviewDialog
        onCloseAutoFocus={(event) => {
          if (!focusHeadingOnClose || allIssuesOpen) return;
          event.preventDefault();
          headingRef.current?.focus({ preventScroll: true });
          setFocusHeadingOnClose(false);
        }}
        onError={handleFixError}
        onOpenChange={(open) => {
          if (!open) setFixTarget(null);
        }}
        onSuccess={handleFixSuccess}
        target={fixTarget}
      />

      <SeriesOrderDisableDialog
        isPending={disableSeries.isPending}
        onConfirm={() => {
          if (disableTarget !== null) handleDisable(disableTarget);
        }}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null);
        }}
        series={disableTarget}
      />

      {wishlistBookId === null ? null : (
        <WantToBuyDialog
          book={{ id: wishlistBookId }}
          onOpenChange={(open) => {
            if (!open) setWishlistBookId(null);
          }}
          open
        />
      )}
    </section>
  );
}

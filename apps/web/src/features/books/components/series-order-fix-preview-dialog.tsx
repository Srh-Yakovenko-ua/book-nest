"use client";

import type { SeriesOrderFixPreviewView, SeriesOrderQueuePreviewItem } from "@app/shared";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { SeriesOrderErrorKey, SeriesOrderFixTarget } from "../model/series-order-check";

import {
  useApplySeriesOrderFix,
  useInvalidateSeriesOrderIssues,
  useSeriesOrderFixPreview,
} from "../api/use-series-order-check";
import { isSeriesOrderStaleError, toSeriesOrderErrorKey } from "../model/series-order-check";

type SeriesOrderFixPreviewDialogProps = {
  onCloseAutoFocus: (event: Event) => void;
  onError: (key: SeriesOrderErrorKey) => void;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  target: null | SeriesOrderFixTarget;
};

const SKELETON_ROWS = 3;

export function SeriesOrderFixPreviewDialog({
  onCloseAutoFocus,
  onError,
  onOpenChange,
  onSuccess,
  target,
}: SeriesOrderFixPreviewDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={target !== null}>
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {target === null ? null : (
          <FixPreview
            onCancel={() => onOpenChange(false)}
            onError={onError}
            onSuccess={onSuccess}
            target={target}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixPreview({
  onCancel,
  onError,
  onSuccess,
  target,
}: {
  onCancel: () => void;
  onError: (key: SeriesOrderErrorKey) => void;
  onSuccess: () => void;
  target: SeriesOrderFixTarget;
}) {
  const t = useTranslations("readingQueue.seriesOrderCheck.preview");
  const tError = useTranslations("readingQueue.seriesOrderCheck.error");
  const preview = useSeriesOrderFixPreview(target);
  const applyFix = useApplySeriesOrderFix();
  const invalidateIssues = useInvalidateSeriesOrderIssues();
  const [errorKey, setErrorKey] = useState<null | SeriesOrderErrorKey>(null);
  const reportedStaleRef = useRef(false);

  const confirmLabel =
    target.strategy === "REORDER_SERIES_SLOTS" ? t("confirmReorder") : t("confirmInsert");
  const previewErrorKey = preview.isError ? toSeriesOrderErrorKey(preview.error) : null;

  useEffect(() => {
    if (previewErrorKey === null || !isSeriesOrderStaleError(previewErrorKey)) return;
    if (reportedStaleRef.current) return;
    reportedStaleRef.current = true;
    void invalidateIssues();
    onError(previewErrorKey);
  }, [invalidateIssues, onError, previewErrorKey]);

  function handleConfirm() {
    setErrorKey(null);
    applyFix.mutate(
      {
        fingerprint: target.fingerprint,
        input: { expectedQueueVersion: target.queueVersion, strategy: target.strategy },
      },
      {
        onError: (error) => {
          const key = toSeriesOrderErrorKey(error);
          setErrorKey(key);
          onError(key);
        },
        onSuccess,
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{target.seriesTitle}</DialogDescription>
      </DialogHeader>

      {preview.isPending ? (
        <div aria-label={t("loading")} className="flex flex-col gap-2" role="status">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton className="h-16 w-full rounded-md" key={index} />
          ))}
        </div>
      ) : preview.data === undefined ? (
        <p className="text-sm text-destructive" role="alert">
          {previewErrorKey === null || previewErrorKey === "generic"
            ? t("error")
            : tError(previewErrorKey)}
        </p>
      ) : (
        <PreviewBody data={preview.data} />
      )}

      {errorKey === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {tError(errorKey)}
        </p>
      )}

      <DialogFooter>
        <Button disabled={applyFix.isPending} onClick={onCancel} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button
          disabled={applyFix.isPending || preview.data === undefined}
          loading={applyFix.isPending}
          onClick={handleConfirm}
          type="button"
        >
          {confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

function PreviewBody({ data }: { data: SeriesOrderFixPreviewView }) {
  const t = useTranslations("readingQueue.seriesOrderCheck.preview");

  const added = data.changes.filter((change) => change.type === "add");
  const moved = data.changes.filter((change) => change.type === "move");

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <QueuePreviewList items={data.before} label={t("current")} />
        <QueuePreviewList items={data.after} label={t("afterFix")} />
      </div>

      {added.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">{t("added")}</p>
          <ul className="flex flex-col gap-1">
            {added.map((change) => (
              <li className="text-sm text-muted-foreground" key={change.bookId}>
                {t("addedItem", { position: change.toPosition, title: change.title })}
              </li>
            ))}
          </ul>
        </div>
      )}

      {moved.length === 0 ? null : (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">{t("moved")}</p>
          <ul className="flex flex-col gap-1">
            {moved.map((change) => (
              <li className="text-sm text-muted-foreground" key={change.bookId}>
                {t("movedItem", {
                  from: change.fromPosition ?? change.toPosition,
                  title: change.title,
                  to: change.toPosition,
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {data.shiftedUnrelatedBooksCount === 0
          ? t("unrelatedUnchanged")
          : t("shiftedUnrelated", { count: data.shiftedUnrelatedBooksCount })}
      </p>

      {data.warnings.length === 0 ? null : (
        <div className="flex flex-col gap-1.5 rounded-md border border-warning/40 bg-warning-soft p-3">
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-warning">
            <UiIcon name="alert-triangle" size={16} />
            {t("warningsTitle")}
          </p>
          <ul className="flex flex-col gap-1">
            {data.warnings.map((warning) => (
              <li className="text-sm text-warning" key={warning}>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QueuePreviewList({
  items,
  label,
}: {
  items: SeriesOrderQueuePreviewItem[];
  label: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <ol className="flex flex-col gap-1">
        {items.map((item) => (
          <li className="flex items-baseline gap-2 text-sm" key={item.bookId}>
            <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
              {item.queuePosition}.
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                item.belongsToAffectedSeries
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
              title={item.title}
            >
              {item.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

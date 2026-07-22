"use client";

import type {
  MediaView,
  Nullable,
  SeriesOrderFixChange,
  SeriesOrderFixPreviewView,
} from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
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

const SKELETON_ROWS = 4;
const MOVE_PREVIEW_LIMIT = 5;
const MOVE_COLLAPSED_COUNT = 3;

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
        className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-lg"
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

function BookCover({ cover, title }: { cover: Nullable<MediaView>; title: string }) {
  const t = useTranslations("readingQueue.seriesOrderCheck.card");

  if (cover === null) {
    return (
      <div className="grid aspect-[3/4] w-12 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={16} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image
        alt={t("coverAlt", { title })}
        className="object-cover"
        fill
        sizes="48px"
        src={cover.urls.thumb}
        unoptimized
      />
    </div>
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

  const data = preview.data;
  const added = data === undefined ? [] : data.changes.filter((change) => change.type === "add");
  const moved = data === undefined ? [] : data.changes.filter((change) => change.type === "move");

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

  const [firstAdded] = added;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {added.length >= 1 ? t("addTitle", { count: added.length }) : t("title")}
        </DialogTitle>
        <DialogDescription>
          {added.length > 1
            ? t("addSubtitleMany", { count: added.length })
            : firstAdded === undefined
              ? target.seriesTitle
              : t("addSubtitle", { bookTitle: firstAdded.title })}
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6">
        {preview.isPending ? (
          <div aria-label={t("loading")} className="flex flex-col gap-2" role="status">
            {Array.from({ length: SKELETON_ROWS }, (_, index) => (
              <Skeleton className="h-16 w-full rounded-md" key={index} />
            ))}
          </div>
        ) : data === undefined ? (
          <p className="text-sm text-destructive" role="alert">
            {previewErrorKey === null || previewErrorKey === "generic"
              ? t("error")
              : tError(previewErrorKey)}
          </p>
        ) : (
          <PreviewBody added={added} data={data} moved={moved} target={target} />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {errorKey === null ? null : (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {tError(errorKey)}
          </p>
        )}
        <DialogFooter>
          <Button
            disabled={applyFix.isPending}
            onClick={onCancel}
            type="button"
            variant="secondary"
          >
            {t("cancel")}
          </Button>
          <Button
            disabled={applyFix.isPending || data === undefined}
            loading={applyFix.isPending}
            onClick={handleConfirm}
            type="button"
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </div>
    </>
  );
}

function PreviewBody({
  added,
  data,
  moved,
  target,
}: {
  added: SeriesOrderFixChange[];
  data: SeriesOrderFixPreviewView;
  moved: SeriesOrderFixChange[];
  target: SeriesOrderFixTarget;
}) {
  const t = useTranslations("readingQueue.seriesOrderCheck.preview");
  const [expanded, setExpanded] = useState(false);

  const enrichmentBooks =
    target.previousBook === null
      ? [target.affectedBook]
      : [target.affectedBook, target.previousBook];
  const coverInfo = new Map<
    string,
    { cover: Nullable<MediaView>; seriesPosition: Nullable<number> }
  >(
    target.recommendedOrder.map((item) => [
      item.bookId,
      { cover: item.cover, seriesPosition: item.seriesPosition },
    ]),
  );
  for (const book of enrichmentBooks) {
    coverInfo.set(book.id, { cover: book.cover, seriesPosition: book.seriesPosition });
  }

  function addedSeriesPosition(bookId: string): Nullable<number> {
    return coverInfo.get(bookId)?.seriesPosition ?? null;
  }

  function addedMetaLine(bookId: string): string {
    const inSeries = t("inSeries", { series: target.seriesTitle });
    const seriesPosition = addedSeriesPosition(bookId);
    if (seriesPosition === null) return inSeries;
    return `${t("seriesBook", { position: seriesPosition })} · ${inSeries}`;
  }

  const showMoveToggle = moved.length > MOVE_PREVIEW_LIMIT;
  const visibleMoves = showMoveToggle && !expanded ? moved.slice(0, MOVE_COLLAPSED_COUNT) : moved;
  const unchanged = data.before.length - moved.length;

  return (
    <div className="flex flex-col gap-5">
      {added.length >= 1 ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{t("addedTitle")}</p>
          <ul className="flex flex-col gap-2">
            {added.map((change) => (
              <li
                className="flex gap-3 rounded-lg border border-success/30 bg-success-soft p-3"
                key={change.bookId}
              >
                <BookCover
                  cover={coverInfo.get(change.bookId)?.cover ?? null}
                  title={change.title}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="truncate text-sm font-medium text-ink" title={change.title}>
                    {change.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{addedMetaLine(change.bookId)}</p>
                  <p className="text-xs font-medium text-success">
                    {t("newPosition", { position: change.toPosition })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {added.length >= 1 && target.recommendedOrder.length >= 2 ? (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{t("seriesOrderTitle")}</p>
          <div className="flex flex-col gap-1">
            {target.recommendedOrder.map((item, index) => {
              const isAdded = added.some((change) => change.bookId === item.bookId);
              return (
                <div className="flex flex-col gap-1" key={item.bookId}>
                  <div className="flex items-baseline gap-2 text-sm">
                    {item.seriesPosition === null ? null : (
                      <span
                        className={cn(
                          "shrink-0 tabular-nums",
                          isAdded ? "font-medium text-success" : "text-muted-foreground",
                        )}
                      >
                        {t("seriesBook", { position: item.seriesPosition })}
                      </span>
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        isAdded ? "font-medium text-success" : "text-muted-foreground",
                      )}
                      title={item.title}
                    >
                      {item.title}
                    </span>
                  </div>
                  {index < target.recommendedOrder.length - 1 ? (
                    <UiIcon
                      aria-hidden
                      className="ml-1 text-muted-foreground/50"
                      name="arrow-down"
                      size={14}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {added.length + moved.length === 0 ? null : (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{t("queueChangesTitle")}</p>
          <ul className="flex flex-col gap-1.5">
            {added.map((change) => (
              <li
                className="flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success"
                key={change.bookId}
              >
                <UiIcon aria-hidden name="plus" size={14} />
                <span className="shrink-0 font-medium tabular-nums">#{change.toPosition}</span>
                <span className="min-w-0 flex-1 truncate" title={change.title}>
                  {change.title}
                </span>
                <span className="shrink-0 text-xs text-success/80">{t("newBook")}</span>
              </li>
            ))}
            {visibleMoves.map((change) => (
              <li
                className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-2 text-sm"
                key={change.bookId}
              >
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  #{change.fromPosition ?? change.toPosition}
                </span>
                <UiIcon
                  aria-hidden
                  className="shrink-0 text-muted-foreground"
                  name="arrow-right"
                  size={14}
                />
                <span className="shrink-0 font-medium text-foreground tabular-nums">
                  #{change.toPosition}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-muted-foreground"
                  title={change.title}
                >
                  {change.title}
                </span>
              </li>
            ))}
          </ul>
          {showMoveToggle ? (
            <div className="flex flex-col gap-1">
              {expanded ? null : (
                <p className="text-xs text-muted-foreground">
                  {t("moreMoves", { count: moved.length - MOVE_COLLAPSED_COUNT })}
                </p>
              )}
              <Button
                className="self-start"
                onClick={() => setExpanded((value) => !value)}
                size="sm"
                variant="ghost"
              >
                <UiIcon name={expanded ? "chevron-up" : "chevron-down"} size={14} />
                {expanded ? t("collapseMoves") : t("showAllMoves")}
              </Button>
            </div>
          ) : null}
        </section>
      )}

      {unchanged > 0 ? (
        <p className="text-xs text-muted-foreground">{t("unchanged", { count: unchanged })}</p>
      ) : null}

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

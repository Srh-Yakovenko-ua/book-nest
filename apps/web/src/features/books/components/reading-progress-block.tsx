"use client";

import type { BookView, ReadingStatus } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RatingScore } from "@/components/ui/rating-score";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { resolveReadingProgress } from "../model/reading-progress";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";
import { UpdateReadingProgressDialog } from "./update-reading-progress-dialog";

const NOT_STARTED_STATUSES: readonly ReadingStatus[] = ["not_started", "want_to_read"];
const UPDATABLE_STATUSES: readonly ReadingStatus[] = ["reading", "rereading", "paused"];

type ReadingProgressBlockProps = {
  book: BookView;
};

export function ReadingProgressBlock({ book }: ReadingProgressBlockProps) {
  const t = useTranslations("books.details.reading");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPreset, setStatusPreset] = useState<ReadingStatus | undefined>(undefined);

  const status = book.readingStatus;
  const isEmpty = NOT_STARTED_STATUSES.includes(status);
  const isUpdatable = UPDATABLE_STATUSES.includes(status);

  function openStatus(preset?: ReadingStatus) {
    setStatusPreset(preset);
    setStatusOpen(true);
  }

  return (
    <>
      <Card className="shadow-detail-block">
        <CardHeader>
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {isEmpty ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{t("empty")}</p>
          ) : (
            <ProgressBody book={book} />
          )}

          <div className="flex flex-col gap-2">
            {isEmpty ? (
              <Button className="w-full" onClick={() => openStatus("reading")}>
                <UiIcon name="book" size={16} />
                {t("startCta")}
              </Button>
            ) : null}
            {isUpdatable ? (
              <Button className="w-full" onClick={() => setUpdateOpen(true)}>
                <UiIcon name="edit" size={16} />
                {t("updateCta")}
              </Button>
            ) : null}
            <Button className="w-full" onClick={() => openStatus()} size="sm" variant="ghost">
              {t("changeStatusCta")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <UpdateReadingProgressDialog book={book} onOpenChange={setUpdateOpen} open={updateOpen} />
      <ChangeReadingStatusDialog
        book={book}
        defaultStatus={statusPreset}
        onOpenChange={setStatusOpen}
        open={statusOpen}
      />
    </>
  );
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm leading-relaxed text-foreground/90">{value}</p>
    </div>
  );
}

function ProgressBody({ book }: { book: BookView }) {
  const t = useTranslations("books.details.reading");
  const tFields = useTranslations("books.readingStatus.fields");
  const locale = useLocale();

  const status = book.readingStatus;
  const rp = book.readingProgress;
  const summary = resolveReadingProgress(book);
  const rating = rp?.rating ?? null;

  const dateRows = [
    { label: tFields("startedAt"), value: rp?.startedAt ?? null },
    { label: tFields("finishedAt"), value: rp?.finishedAt ?? null },
    { label: tFields("pausedAt"), value: rp?.pausedAt ?? null },
    { label: tFields("abandonedAt"), value: rp?.abandonedAt ?? null },
    { label: t("lastUpdate"), value: rp?.lastProgressUpdateAt ?? null },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  return (
    <div className="flex flex-col gap-4">
      {status === "finished" && book.pagesCount !== null ? (
        <div className="flex flex-col gap-1.5">
          <Progress aria-label={t("progressLabel")} className="h-1.5" value={100} />
          <ProgressLine current={book.pagesCount} percent={100} total={book.pagesCount} />
        </div>
      ) : null}

      {status !== "finished" && summary !== null ? (
        <div className="flex flex-col gap-1.5">
          <Progress
            aria-label={t("progressLabel")}
            className={cn("h-1.5", status === "dnf" && "opacity-60")}
            value={summary.percent}
          />
          <ProgressLine current={summary.current} percent={summary.percent} total={summary.total} />
        </div>
      ) : null}

      {status !== "finished" && summary === null && rp?.currentPage != null ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("pagesOnly", { current: rp.currentPage })}
        </p>
      ) : null}

      {rating === null ? null : <RatingScore value={rating} />}

      {dateRows.length === 0 ? null : (
        <dl className="flex flex-col gap-2">
          {dateRows.map((row) => (
            <div className="flex items-baseline justify-between gap-4" key={row.label}>
              <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-sm text-foreground/90 tabular-nums">
                {formatDate(row.value, locale)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {rp?.note == null ? null : (
        <NoteBlock
          label={status === "dnf" ? t("statusDialog.reason") : tFields("note")}
          value={rp.note}
        />
      )}
      {rp?.impression == null ? null : (
        <NoteBlock label={tFields("impression")} value={rp.impression} />
      )}
    </div>
  );
}

function ProgressLine({
  current,
  percent,
  total,
}: {
  current: number;
  percent: number;
  total: number;
}) {
  const tDetails = useTranslations("books.details");
  return (
    <div className="flex items-baseline justify-between gap-2 tabular-nums">
      <span className="text-sm text-muted-foreground">
        {tDetails("progressPages", { current, total })}
      </span>
      <span className="text-sm font-semibold text-primary">{percent}%</span>
    </div>
  );
}

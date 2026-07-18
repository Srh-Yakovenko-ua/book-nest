"use client";

import type { BookView, ReadingActivityRange, ReadingStatus } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { useReadingHistory } from "../../api/use-reading-history";
import { ChangeReadingStatusDialog } from "../change-reading-status-dialog";
import { FormSection } from "../form-section";
import { ReadingHistoryError } from "../reading/reading-history-error";
import { hasReadingProgress } from "../reading/reading-progress-guard";
import { readingStatusTitleKey } from "../reading/reading-status-title";
import { UpdateReadingProgressDialog } from "../update-reading-progress-dialog";
import { ReadingActivitySection } from "./reading-activity-section";
import { ReadingHistoryCompletenessNotice } from "./reading-history-completeness-notice";
import { ReadingProgressEmpty } from "./reading-progress-empty";
import { ReadingProgressForecast } from "./reading-progress-forecast";
import { ReadingProgressSkeleton } from "./reading-progress-skeleton";
import { ReadingProgressStats } from "./reading-progress-stats";
import { ReadingProgressSummary } from "./reading-progress-summary";
import { RecentReadingActivity } from "./recent-reading-activity";

const NOT_STARTED_STATUSES: readonly ReadingStatus[] = ["not_started", "want_to_read"];
const UPDATABLE_STATUSES: readonly ReadingStatus[] = ["reading", "rereading", "paused"];

type ReadingProgressBlockProps = {
  book: BookView;
  onViewFullHistory: () => void;
};

type ReadingProgressBodyProps = {
  activityRange: ReadingActivityRange;
  book: BookView;
  onRangeChange: (value: ReadingActivityRange) => void;
  onViewFullHistory: () => void;
  query: ReturnType<typeof useReadingHistory>;
};

export function ReadingProgressBlock({ book, onViewFullHistory }: ReadingProgressBlockProps) {
  const t = useTranslations("books.details.reading");
  const [activityRange, setActivityRange] = useState<ReadingActivityRange>("7d");
  const [updateOpen, setUpdateOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusPreset, setStatusPreset] = useState<ReadingStatus | undefined>(undefined);

  const query = useReadingHistory(book.id, { activityRange, limit: 3, page: 1, sort: "desc" });

  const status = book.readingStatus;
  const isNotStarted = NOT_STARTED_STATUSES.includes(status);
  const isUpdatable = UPDATABLE_STATUSES.includes(status);

  function openStatus(preset?: ReadingStatus) {
    setStatusPreset(preset);
    setStatusOpen(true);
  }

  return (
    <>
      <FormSection icon="chart" title={t(readingStatusTitleKey(status))}>
        <ReadingProgressBody
          activityRange={activityRange}
          book={book}
          onRangeChange={setActivityRange}
          onViewFullHistory={onViewFullHistory}
          query={query}
        />

        <div className="flex flex-col gap-2">
          {isNotStarted ? (
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
      </FormSection>

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

function ReadingProgressBody({
  activityRange,
  book,
  onRangeChange,
  onViewFullHistory,
  query,
}: ReadingProgressBodyProps) {
  const t = useTranslations("books.details.reading");

  if (query.isPending) return <ReadingProgressSkeleton />;

  if (query.data === undefined) {
    return <ReadingHistoryError onRetry={() => void query.refetch()} />;
  }

  const { activity, history, summary } = query.data;

  if (!hasReadingProgress(summary)) return <ReadingProgressEmpty message={t("emptyNeutral")} />;

  const isLegacy = summary.updatesCount === 0;
  const isReading = summary.status === "reading" || summary.status === "rereading";
  const showCompleteness =
    !summary.historyCompleteness.isComplete && summary.historyCompleteness.untrackedPages > 0;
  const isRefetching = query.isFetching && query.isPlaceholderData;

  return (
    <div className="flex flex-col gap-5">
      {query.isError ? <ReadingHistoryError onRetry={() => void query.refetch()} /> : null}

      <ReadingProgressSummary book={book} summary={summary} />
      <ReadingProgressStats summary={summary} />

      {isReading && summary.estimatedActiveDaysRemaining !== null ? (
        <ReadingProgressForecast
          estimatedActiveDaysRemaining={summary.estimatedActiveDaysRemaining}
        />
      ) : null}

      {showCompleteness ? <ReadingHistoryCompletenessNotice /> : null}

      {isLegacy ? (
        <ReadingProgressEmpty icon="clock" message={t("legacyNoHistory")} />
      ) : (
        <>
          <ReadingActivitySection
            activity={activity}
            isRefetching={isRefetching}
            onRangeChange={onRangeChange}
            range={activityRange}
          />
          <RecentReadingActivity days={history.days} onViewFullHistory={onViewFullHistory} />
        </>
      )}
    </div>
  );
}

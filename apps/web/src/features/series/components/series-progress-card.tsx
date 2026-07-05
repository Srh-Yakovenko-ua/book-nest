"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { seriesProgress } from "../model/series-derive";

type SeriesProgressCardProps = {
  details: SeriesDetailsView;
};

export function SeriesProgressCard({ details }: SeriesProgressCardProps) {
  const t = useTranslations("series.details.progress");
  const progress = seriesProgress(details);
  const { stats } = details;
  const percent = progress.fullyRead ? 100 : progress.percent;

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {progress.hasBooks ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground/90">
                {details.totalBooks === null
                  ? t("booksAdded", { count: progress.denominator, finished: progress.finished })
                  : t("booksOfTotal", { finished: progress.finished, total: details.totalBooks })}
              </p>
              <span className="text-sm font-semibold text-primary tabular-nums">{percent}%</span>
            </div>
            <Progress aria-label={t("title")} className="h-2" value={percent} />
            {progress.fullyRead ? (
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <UiIcon name="check-circle" size={16} />
                {t("completed")}
              </p>
            ) : (
              <dl className="flex flex-col gap-2">
                <ProgressLine
                  label={t("finished", { count: stats.finishedCount })}
                  tone="success"
                />
                <ProgressLine label={t("reading", { count: stats.readingCount })} tone="info" />
                <ProgressLine label={t("unread", { count: stats.unreadCount })} tone="muted" />
              </dl>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ProgressLine({ label, tone }: { label: string; tone: "info" | "muted" | "success" }) {
  const dotClass =
    tone === "success" ? "bg-success" : tone === "info" ? "bg-info" : "bg-muted-foreground/50";

  return (
    <div className="flex items-center gap-2 text-sm text-foreground/85">
      <span className={`size-2 shrink-0 rounded-full ${dotClass}`} />
      {label}
    </div>
  );
}

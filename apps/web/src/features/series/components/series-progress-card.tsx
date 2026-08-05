"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon, type UiIconName } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import { seriesProgress } from "../model/series-derive";
import { seriesProgressStatus, type SeriesProgressStatus } from "../model/series-details-derive";

type SeriesProgressCardProps = {
  details: SeriesDetailsView;
};

type StatusLineView = {
  icon: UiIconName;
  primary: string;
  secondary: null | string;
  tone: "default" | "success";
};

export function SeriesProgressCard({ details }: SeriesProgressCardProps) {
  const t = useTranslations("series.details.progress");
  const progress = seriesProgress(details);
  const percent = progress.fullyRead ? 100 : progress.percent;
  const status = seriesProgressStatus(details);

  return (
    <Card className="gap-3">
      <CardHeader>
        <div className="flex items-baseline justify-between gap-2">
          <CardTitle asChild>
            <h2>{t("title")}</h2>
          </CardTitle>
          <span className="text-sm font-semibold text-primary tabular-nums">{percent}%</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Progress aria-label={t("title")} aria-valuenow={percent} className="h-2" value={percent} />
        <SeriesProgressStatusLine status={status} />
      </CardContent>
    </Card>
  );
}

function SeriesProgressStatusLine({ status }: { status: SeriesProgressStatus }) {
  const t = useTranslations("series.details.progress");
  const view = resolveView();

  function resolveView(): StatusLineView {
    switch (status.kind) {
      case "completed":
        return {
          icon: "check-circle",
          primary: t("statusCompleted"),
          secondary: null,
          tone: "success",
        };
      case "missingPart":
        return {
          icon: "check-circle",
          primary: t("statusMissingTitle"),
          secondary: t("statusMissingDetail", { position: status.position }),
          tone: "default",
        };
      case "nextUnread":
        return {
          icon: "arrow-right",
          primary: t("statusNextTitle", { title: status.title }),
          secondary:
            status.position === null ? null : t("statusPosition", { position: status.position }),
          tone: "default",
        };
      case "notStarted":
        return {
          icon: "clock",
          primary: t("statusNotStarted"),
          secondary: null,
          tone: "default",
        };
      case "ongoingAllRead":
        return {
          icon: "clock",
          primary: t("statusOngoingTitle"),
          secondary: t("statusOngoingDetail"),
          tone: "default",
        };
      case "reading": {
        const parts: string[] = [];
        if (status.position !== null) {
          parts.push(t("statusPosition", { position: status.position }));
        }
        if (status.bookPercent !== null) {
          parts.push(t("statusBookPercent", { percent: status.bookPercent }));
        }
        return {
          icon: "book",
          primary: t("statusReadingTitle", { title: status.title }),
          secondary: parts.length === 0 ? null : parts.join(" · "),
          tone: "default",
        };
      }
    }
  }

  return (
    <div className="flex items-start gap-2">
      <UiIcon
        className={cn("mt-0.5 shrink-0", view.tone === "success" ? "text-success" : "text-primary")}
        name={view.icon}
        size={16}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{view.primary}</p>
        {view.secondary === null ? null : (
          <p className="text-xs text-muted-foreground">{view.secondary}</p>
        )}
      </div>
    </div>
  );
}

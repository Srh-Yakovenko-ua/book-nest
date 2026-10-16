import type {
  BookLanguage,
  ReadingStatisticsInsight,
  ReadingStatisticsInsightCode,
} from "@app/shared";

import type { UiIconName } from "@/components/icons";

export type StatisticsInsightValues = Record<string, number | string>;

type ComparisonInsightCode = Extract<
  ReadingStatisticsInsightCode,
  "completed_reads_vs_comparison" | "pages_read_vs_comparison"
>;

const INSIGHT_ICON = {
  comparison: { down: "trend-down", up: "trend-up" },
  observation: {
    dominant_language: "globe",
    high_rating_share: "star",
    longest_streak_in_period: "flame",
    most_active_weekday: "calendar",
    new_authors_discovered: "sparkles",
    series_marathon: "book-copy",
    top_author_reads: "user",
    top_genre_share: "pie",
  },
} as const satisfies {
  comparison: Record<"down" | "up", UiIconName>;
  observation: Record<Exclude<ReadingStatisticsInsightCode, ComparisonInsightCode>, UiIconName>;
};

export type StatisticsInsightFormatters = {
  day: (day: string) => string;
  genre: (genreKey: string) => string;
  language: (language: BookLanguage) => string;
  rating: (value: number) => string;
  share: (ratio: number) => string;
  weekday: (weekday: number) => string;
};

export type StatisticsInsightView = {
  code: ReadingStatisticsInsightCode;
  icon: UiIconName;
  values: StatisticsInsightValues;
};

export function toInsightView({
  format,
  insight,
  isLowerBound,
}: {
  format: StatisticsInsightFormatters;
  insight: ReadingStatisticsInsight;
  isLowerBound: boolean;
}): StatisticsInsightView {
  return {
    code: insight.code,
    icon: insightIcon(insight),
    values: toInsightValues({ format, insight, isLowerBound }),
  };
}

function insightDirection(absoluteDelta: number): "down" | "up" {
  return absoluteDelta < 0 ? "down" : "up";
}

function insightIcon(insight: ReadingStatisticsInsight): UiIconName {
  switch (insight.code) {
    case "completed_reads_vs_comparison":
    case "pages_read_vs_comparison":
      return INSIGHT_ICON.comparison[insightDirection(insight.params.absoluteDelta)];
    default:
      return INSIGHT_ICON.observation[insight.code];
  }
}

function toInsightValues({
  format,
  insight,
  isLowerBound,
}: {
  format: StatisticsInsightFormatters;
  insight: ReadingStatisticsInsight;
  isLowerBound: boolean;
}): StatisticsInsightValues {
  switch (insight.code) {
    case "completed_reads_vs_comparison":
    case "pages_read_vs_comparison":
      return {
        absoluteDelta: Math.abs(insight.params.absoluteDelta),
        comparisonValue: insight.params.comparisonValue,
        currentValue: insight.params.currentValue,
        direction: insightDirection(insight.params.absoluteDelta),
        percentDelta:
          insight.params.percentDelta === null
            ? ""
            : format.share(Math.abs(insight.params.percentDelta) / 100),
      };
    case "dominant_language":
      return {
        completedReadCount: insight.params.completedReadCount,
        language: format.language(insight.params.language),
        share: format.share(insight.params.shareOfKnown),
      };
    case "high_rating_share":
      return {
        averageRating: format.rating(insight.params.averageRating),
        highRatedReadsCount: insight.params.highRatedReadsCount,
        ratedReadsCount: insight.params.ratedReadsCount,
      };
    case "longest_streak_in_period":
      return {
        days: insight.params.days,
        endDate: format.day(insight.params.endDate),
        history: isLowerBound ? "lowerBound" : "exact",
        startDate: format.day(insight.params.startDate),
      };
    case "most_active_weekday":
      return {
        activeDays: insight.params.activeDays,
        pagesRead: insight.params.pagesRead,
        weekday: format.weekday(insight.params.weekday),
      };
    case "new_authors_discovered":
      return {
        authorCount: insight.params.authorCount,
        firstAuthorName: insight.params.firstAuthorName,
      };
    case "series_marathon":
      return {
        marathonLength: insight.params.marathonLength,
        seriesName: insight.params.seriesName,
      };
    case "top_author_reads":
      return {
        authorName: insight.params.authorName,
        completedReadCount: insight.params.completedReadCount,
      };
    case "top_genre_share":
      return {
        completedReadCount: insight.params.completedReadCount,
        genreKey: format.genre(insight.params.genreKey),
        share: format.share(insight.params.shareOfCompletedReads),
      };
  }
}

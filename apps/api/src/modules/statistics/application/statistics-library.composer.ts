import type { ReadingStatisticsLibraryBalanceSection } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type {
  LibraryForecastSample,
  LibrarySnapshot,
} from "../infrastructure/statistics-library.repository.js";

const MIN_FORECAST_SAMPLE = 3;

const MONTHS_PER_YEAR = 12;

@Injectable()
export class StatisticsLibraryComposer {
  compose({
    forecastSample,
    snapshot,
  }: {
    forecastSample: LibraryForecastSample;
    snapshot: LibrarySnapshot;
  }): ReadingStatisticsLibraryBalanceSection {
    return {
      currentOwnedTotal: snapshot.ownedTotal,
      currentTbrCount: snapshot.tbrCount,
      flow: { availability: "unavailable", data: null, reason: "HISTORY_NOT_TRACKED" },
      forecast: this.buildForecast({ forecastSample, snapshot }),
      readRatio: snapshot.ownedTotal === 0 ? null : snapshot.readCount / snapshot.ownedTotal,
    };
  }

  private buildForecast({
    forecastSample,
    snapshot,
  }: {
    forecastSample: LibraryForecastSample;
    snapshot: LibrarySnapshot;
  }): ReadingStatisticsLibraryBalanceSection["forecast"] {
    if (forecastSample.unresolvedFirstCompletions > 0) {
      return { availability: "unavailable", data: null, reason: "LEGACY_HISTORY_INCOMPLETE" };
    }
    if (forecastSample.provenFirstCompletions < MIN_FORECAST_SAMPLE) {
      return { availability: "unavailable", data: null, reason: "INSUFFICIENT_SAMPLE" };
    }

    const readsPerMonth = forecastSample.provenFirstCompletions / MONTHS_PER_YEAR;
    return {
      availability: "available",
      data: { monthsRemaining: snapshot.tbrCount / readsPerMonth, readsPerMonth },
    };
  }
}

import type { TimelineLocationsView } from "@app/shared";

import { TIMELINE_ERROR_CODES, TIMELINE_LOCATION_USAGE_MAX } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { mergeTextUsage } from "../../../core/text-usage.js";
import { resolveLocationScope } from "../domain/location-scope.js";
import { TimelineLocationRepository } from "../infrastructure/timeline-location.repository.js";

@Injectable()
export class TimelineLocationService {
  constructor(private readonly timelineLocationRepository: TimelineLocationRepository) {}

  async getLocations({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<TimelineLocationsView> {
    const book = await this.timelineLocationRepository.findOwnedBookSeries({ bookId, userId });
    if (book === null) {
      throw new NotFoundError("Book not found", { code: TIMELINE_ERROR_CODES.bookNotFound });
    }

    const scope = resolveLocationScope({ bookId, series: book.series, userId });
    const rows = await this.timelineLocationRepository.findLocationUsage(scope);
    const merged = mergeTextUsage({
      limit: TIMELINE_LOCATION_USAGE_MAX,
      usages: rows.map((row) => ({ count: row.count, text: row.location })),
    });
    return { locations: merged.map((usage) => ({ count: usage.count, location: usage.text })) };
  }
}

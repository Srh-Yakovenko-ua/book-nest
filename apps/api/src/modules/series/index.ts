export { SeriesService } from "./application/series.service.js";
export { resolveSeriesCanonicalAuthors } from "./domain/series-canonical-authors.js";
export {
  resolveContinuationReason,
  resolveSeriesContinuation,
  toContinuationProgress,
} from "./domain/series-continuation.js";
export { toSeriesBookPreview } from "./domain/series-preview.js";
export { toSeriesView } from "./domain/series.mapper.js";
export {
  buildSeriesCanonicalAuthorMatch,
  buildSeriesCanonicalAuthorSortKey,
  buildSeriesIdsInReadingStates,
} from "./infrastructure/series-search-sql.js";
export { SeriesModule } from "./series.module.js";

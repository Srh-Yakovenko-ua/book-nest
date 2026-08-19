export { SeriesService } from "./application/series.service.js";
export {
  compareByPartThenCreated,
  computeHasUnreadEarlierParts,
  selectNextBook,
  toSeriesBookPreview,
} from "./domain/series-preview.js";
export type { EarlierPartCandidate } from "./domain/series-preview.js";
export { toSeriesView } from "./domain/series.mapper.js";
export { SeriesModule } from "./series.module.js";

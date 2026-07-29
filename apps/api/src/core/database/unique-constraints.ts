export const UNIQUE_CONSTRAINT = {
  bookSeriesPartNumber: "books_series_id_part_number_key",
  listName: "book_lists_user_id_normalized_name_key",
  seriesName: "series_user_id_normalized_name_key",
  timelineName: "book_timelines_book_id_name_lower_idx",
} as const;

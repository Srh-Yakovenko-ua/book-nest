import { z } from "zod";

import { BookAuthorRefSchema } from "./authors.js";
import { OwnershipStatusSchema, ReadingStatusSchema } from "./book-enums.js";
import { createPaginatedSchema, paginationQueryFields } from "./common.js";
import { GenreKeySchema } from "./genres.js";
import { CountSchema, isoDay, queryStringArray } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import {
  SeriesContinuationRankReasonSchema,
  SeriesReadingStateSchema,
  SeriesStatusSchema,
} from "./series.js";
import { TRASH_PAGE_SIZE_DEFAULT, TrashDeletionResultSchema } from "./trash.js";

const NOTE_SEARCH_MAX = 100;
const NOTES_DEFAULT_PAGE_SIZE = 20;

export const NOTE_INPUT_LIMITS = {
  chapterMax: 100,
  customCategoryMax: 100,
  pageMax: 2147483647,
  textMax: 5000,
} as const;

const NOTE_OVERVIEW_LIMITS = { impressionKeyMax: 512, seriesBeforeNextBookPreview: 5 } as const;

export const NOTE_ERROR_CODES = {
  bookNotFound: "note_book_not_found",
  noteNotFound: "note_not_found",
  seriesNoteLocationUnsupported: "note_series_location_unsupported",
  seriesNotFound: "note_series_not_found",
} as const;

const noteCustomCategoryText = z.string().trim().max(NOTE_INPUT_LIMITS.customCategoryMax);

export const NoteCustomCategorySchema = noteCustomCategoryText.min(1);

const NoteBooleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const NoteEntityTypeSchema = z.enum(["book", "series"]);

export type NoteEntityType = z.infer<typeof NoteEntityTypeSchema>;

export const NoteCategorySchema = z.enum([
  "general_impression",
  "characters",
  "plot",
  "atmosphere",
  "worldbuilding",
  "theme_idea",
  "author_style",
  "for_review",
  "question",
  "other",
]);

export type NoteCategory = z.infer<typeof NoteCategorySchema>;

export const NoteFilterSchema = z.enum(["all", "no_spoiler", "with_spoiler", "favorite", "pinned"]);

export type NoteFilter = z.infer<typeof NoteFilterSchema>;

export const BookNoteSortSchema = z.enum([
  "newest",
  "oldest",
  "recently_updated",
  "title",
  "author",
  "page",
  "pinned_first",
]);

export type BookNoteSort = z.infer<typeof BookNoteSortSchema>;

export const SeriesNoteSortSchema = z.enum([
  "newest",
  "oldest",
  "recently_updated",
  "title",
  "author",
  "pinned_first",
]);

export type SeriesNoteSort = z.infer<typeof SeriesNoteSortSchema>;

export const NOTE_ARCHIVE_SORT_DEFAULT = "newest" satisfies BookNoteSort & SeriesNoteSort;

export const CreateNoteInputSchema = z.object({
  category: NoteCategorySchema.nullish(),
  chapter: z.string().trim().max(NOTE_INPUT_LIMITS.chapterMax).nullish(),
  customCategory: noteCustomCategoryText.nullish(),
  isFavorite: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  isSpoiler: z.boolean().default(false),
  page: z.coerce.number().int().positive().max(NOTE_INPUT_LIMITS.pageMax).nullish(),
  text: z.string().trim().min(1).max(NOTE_INPUT_LIMITS.textMax),
});

export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const CreateSeriesNoteInputSchema = CreateNoteInputSchema.omit({
  chapter: true,
  page: true,
});

export type CreateSeriesNoteInput = z.infer<typeof CreateSeriesNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  category: NoteCategorySchema.nullish(),
  chapter: z.string().trim().max(NOTE_INPUT_LIMITS.chapterMax).nullish(),
  customCategory: noteCustomCategoryText.nullish(),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
  page: z.coerce.number().int().positive().max(NOTE_INPUT_LIMITS.pageMax).nullish(),
  text: z.string().trim().min(1).max(NOTE_INPUT_LIMITS.textMax).optional(),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;

const noteArchiveSearchField = z.string().trim().max(NOTE_SEARCH_MAX).optional();

const noteCategoryDimensionFields = {
  category: queryStringArray(NoteCategorySchema),
  customCategory: queryStringArray(NoteCustomCategorySchema),
};

const bookNotesDatasetQueryFields = {
  ...noteCategoryDimensionFields,
  author: queryStringArray(z.uuid()),
  book: queryStringArray(z.uuid()),
  hasChapter: NoteBooleanQuerySchema.optional(),
  hasPage: NoteBooleanQuerySchema.optional(),
  search: noteArchiveSearchField,
};

const seriesNotesDatasetQueryFields = {
  ...noteCategoryDimensionFields,
  author: queryStringArray(z.uuid()),
  genre: queryStringArray(GenreKeySchema),
  reading: queryStringArray(SeriesReadingStateSchema),
  search: noteArchiveSearchField,
  series: queryStringArray(z.uuid()),
  status: queryStringArray(SeriesStatusSchema),
};

export const BookNotesQuerySchema = z.object({
  ...bookNotesDatasetQueryFields,
  filter: NoteFilterSchema.default("all"),
  ...paginationQueryFields({ pageSizeDefault: NOTES_DEFAULT_PAGE_SIZE }),
  sort: BookNoteSortSchema.default(NOTE_ARCHIVE_SORT_DEFAULT),
});

export type BookNotesQuery = z.infer<typeof BookNotesQuerySchema>;

export const BookNotesFacetsQuerySchema = z.object(bookNotesDatasetQueryFields);

export type BookNotesFacetsQuery = z.infer<typeof BookNotesFacetsQuerySchema>;

export const SeriesNotesQuerySchema = z.object({
  ...seriesNotesDatasetQueryFields,
  filter: NoteFilterSchema.default("all"),
  ...paginationQueryFields({ pageSizeDefault: NOTES_DEFAULT_PAGE_SIZE }),
  sort: SeriesNoteSortSchema.default(NOTE_ARCHIVE_SORT_DEFAULT),
});

export type SeriesNotesQuery = z.infer<typeof SeriesNotesQuerySchema>;

export const SeriesNotesFacetsQuerySchema = z.object(seriesNotesDatasetQueryFields);

export type SeriesNotesFacetsQuery = z.infer<typeof SeriesNotesFacetsQuerySchema>;

export const NoteBookPreviewSchema = z.object({
  author: z.string().nullable(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export type NoteBookPreview = z.infer<typeof NoteBookPreviewSchema>;

export const NoteSeriesPreviewSchema = z.object({
  authors: z.array(z.string()),
  booksCount: z.number().int().nonnegative(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  name: z.string(),
});

export type NoteSeriesPreview = z.infer<typeof NoteSeriesPreviewSchema>;

export const NoteViewSchema = z.object({
  book: NoteBookPreviewSchema.nullable(),
  category: NoteCategorySchema.nullable(),
  chapter: z.string().nullable(),
  createdAt: z.string(),
  customCategory: z.string().nullable(),
  entityType: NoteEntityTypeSchema,
  id: z.string(),
  isFavorite: z.boolean(),
  isPinned: z.boolean(),
  isSpoiler: z.boolean(),
  page: z.number().int().nullable(),
  series: NoteSeriesPreviewSchema.nullable(),
  text: z.string(),
  updatedAt: z.string(),
});

export type NoteView = z.infer<typeof NoteViewSchema>;

export const PaginatedNotesSchema = createPaginatedSchema(NoteViewSchema);

export const EntityNotesViewSchema = z.object({
  notes: z.array(NoteViewSchema),
  totalCount: z.number().int().nonnegative(),
});

export type EntityNotesView = z.infer<typeof EntityNotesViewSchema>;

export const NoteMemoryBookSourceSchema = z.object({
  authors: z.array(BookAuthorRefSchema),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  seriesPosition: z.number().int().nullable(),
  title: z.string(),
  type: z.literal("book"),
});

export type NoteMemoryBookSource = z.infer<typeof NoteMemoryBookSourceSchema>;

export const NoteMemorySeriesSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.literal("series"),
});

export type NoteMemorySeriesSource = z.infer<typeof NoteMemorySeriesSourceSchema>;

export const NoteMemorySourceSchema = z.discriminatedUnion("type", [
  NoteMemoryBookSourceSchema,
  NoteMemorySeriesSourceSchema,
]);

export type NoteMemorySource = z.infer<typeof NoteMemorySourceSchema>;

const NoteImpressionKeySchema = z
  .string()
  .min(1)
  .max(NOTE_OVERVIEW_LIMITS.impressionKeyMax)
  .describe(
    "Opaque key of this rediscovery selection; send it back unchanged to record that the note was shown.",
  );

export const NoteMemoryViewSchema = z.object({
  impressionKey: NoteImpressionKeySchema,
  note: NoteViewSchema,
  source: NoteMemorySourceSchema.describe(
    "Where the note belongs, discriminated on type, so the client never infers it from nullable ids.",
  ),
});

export type NoteMemoryView = z.infer<typeof NoteMemoryViewSchema>;

export const PostFinishNotesViewSchema = z.object({
  book: NoteBookPreviewSchema,
  favoritesCount: CountSchema.describe("Notes of the book the reader marked as favorite."),
  finishedAt: isoDay().describe("The day the reading cycle was finished."),
  notesCount: CountSchema.describe("Active notes of the book, spoilers included."),
  pinnedCount: CountSchema.describe("Notes of the book the reader pinned."),
  readingCycleId: z
    .uuid()
    .describe("The reading cycle this recap belongs to, and the key the review mutation takes."),
});

export type PostFinishNotesView = z.infer<typeof PostFinishNotesViewSchema>;

export const BookNotesOverviewViewSchema = z.object({
  memoryNote: NoteMemoryViewSchema.nullable().describe(
    "An older book note, picked once per local day, or null while fewer than two notes qualify.",
  ),
  postFinish: PostFinishNotesViewSchema.nullable().describe(
    "The recap of a book finished within the last 30 days whose notes the reader has not reviewed yet, or null when no reading cycle qualifies.",
  ),
});

export type BookNotesOverviewView = z.infer<typeof BookNotesOverviewViewSchema>;

export const SeriesBeforeNextBookNoteSchema = NoteViewSchema.extend({
  sourceBook: z.object({
    id: z.string(),
    seriesPosition: z.number().int().nullable(),
    title: z.string(),
  }),
});

export type SeriesBeforeNextBookNote = z.infer<typeof SeriesBeforeNextBookNoteSchema>;

export const SeriesBeforeNextBookViewSchema = z.object({
  continuation: z.object({
    authors: z.array(BookAuthorRefSchema),
    cover: MediaViewSchema.nullable(),
    id: z.string(),
    ownershipStatus: OwnershipStatusSchema,
    progress: z
      .object({
        currentPage: z.number().int(),
        percentage: z.number().int().nullable(),
        totalPages: z.number().int().nullable(),
      })
      .nullable(),
    readingStatus: ReadingStatusSchema,
    reason: SeriesContinuationRankReasonSchema,
    seriesPosition: z.number().int().nullable(),
    title: z.string(),
  }),
  notes: z
    .array(SeriesBeforeNextBookNoteSchema)
    .max(NOTE_OVERVIEW_LIMITS.seriesBeforeNextBookPreview),
  previewLimit: z.literal(NOTE_OVERVIEW_LIMITS.seriesBeforeNextBookPreview),
  series: z.object({
    id: z.string(),
    knownBooksCount: CountSchema,
    title: z.string(),
    totalBooks: z.number().int().nonnegative().nullable(),
  }),
  totalCount: CountSchema.describe("Every note that qualifies for the recap, beyond the preview."),
});

export type SeriesBeforeNextBookView = z.infer<typeof SeriesBeforeNextBookViewSchema>;

export const SeriesNotesOverviewViewSchema = z.object({
  beforeNextBook: SeriesBeforeNextBookViewSchema.nullable().describe(
    "Notes on the closed books before the series continuation, or null when nothing qualifies.",
  ),
  memoryNote: NoteMemoryViewSchema.nullable().describe(
    "An older note of the series or its books, picked once per local day, or null while fewer than two notes qualify.",
  ),
});

export type SeriesNotesOverviewView = z.infer<typeof SeriesNotesOverviewViewSchema>;

export const SeriesNotesOverviewQuerySchema = z.object({
  series: queryStringArray(z.uuid()).describe(
    "The series filter of the page. One id pins the overview to that series; several ids restrict the backend pick to them; none lets the backend pick among every series.",
  ),
});

export type SeriesNotesOverviewQuery = z.infer<typeof SeriesNotesOverviewQuerySchema>;

export const NoteRediscoveryImpressionInputSchema = z.object({
  impressionKey: NoteImpressionKeySchema,
});

export type NoteRediscoveryImpressionInput = z.infer<typeof NoteRediscoveryImpressionInputSchema>;

export const NotePostFinishReviewInputSchema = z.object({
  readingCycleId: z.uuid(),
});

export type NotePostFinishReviewInput = z.infer<typeof NotePostFinishReviewInputSchema>;

const NOTE_FACET_SELF_EXCLUSION_RULE =
  "The list answers to search and every advanced filter except its own dimension and the quick filter, so picking one value never makes another value of the same dimension disappear.";

const NOTE_CATEGORY_FACET_SELF_EXCLUSION_RULE =
  "Standard and custom categories are one logical dimension: both lists answer to search and every other advanced filter, never to the selected categories, custom categories or the quick filter.";

export const NoteQuickCountsSchema = z
  .object({
    all: CountSchema.describe("Notes of the scope, whatever their flags."),
    favorite: CountSchema.describe("Notes of the scope marked as favorite."),
    no_spoiler: CountSchema.describe("Notes of the scope not marked as a spoiler."),
    pinned: CountSchema.describe("Notes of the scope that are pinned."),
    with_spoiler: CountSchema.describe("Notes of the scope marked as a spoiler."),
  })
  .describe(
    "Quick-filter chip counts keyed by the filter value. The scope answers to search and every advanced filter, never to the active quick filter, sort or pagination, so picking one chip never moves the number shown on another one.",
  );

export type NoteQuickCounts = z.infer<typeof NoteQuickCountsSchema>;

export const NoteCategoryFacetSchema = z.object({
  category: NoteCategorySchema,
  count: CountSchema,
});

export type NoteCategoryFacet = z.infer<typeof NoteCategoryFacetSchema>;

export const NoteValueFacetSchema = z.object({
  count: CountSchema,
  value: z.string(),
});

export type NoteValueFacet = z.infer<typeof NoteValueFacetSchema>;

export const NoteAuthorFacetSchema = z.object({
  count: CountSchema,
  id: z.string(),
  name: z.string(),
});

export type NoteAuthorFacet = z.infer<typeof NoteAuthorFacetSchema>;

export const NoteBookFacetSchema = z.object({
  count: CountSchema,
  id: z.string(),
  title: z.string(),
});

export type NoteBookFacet = z.infer<typeof NoteBookFacetSchema>;

export const NoteSeriesFacetSchema = z.object({
  count: CountSchema,
  id: z.string(),
  name: z.string(),
});

export type NoteSeriesFacet = z.infer<typeof NoteSeriesFacetSchema>;

const noteCategoryFacetFields = {
  categories: z
    .array(NoteCategoryFacetSchema)
    .describe(
      `Standard categories used by notes of the scope, with their note counts. ${NOTE_CATEGORY_FACET_SELF_EXCLUSION_RULE}`,
    ),
  customCategories: z
    .array(NoteValueFacetSchema)
    .describe(
      `Custom categories used by notes of the scope, with their note counts. ${NOTE_CATEGORY_FACET_SELF_EXCLUSION_RULE}`,
    ),
  quickCounts: NoteQuickCountsSchema,
};

export const BookNotesFacetsViewSchema = z.object({
  ...noteCategoryFacetFields,
  authors: z
    .array(NoteAuthorFacetSchema)
    .describe(
      `Authors of books holding a note of the scope; a co-authored book credits its notes to every author. ${NOTE_FACET_SELF_EXCLUSION_RULE}`,
    ),
  books: z
    .array(NoteBookFacetSchema)
    .describe(
      `Books holding a note of the scope, with their note counts. ${NOTE_FACET_SELF_EXCLUSION_RULE}`,
    ),
});

export type BookNotesFacetsView = z.infer<typeof BookNotesFacetsViewSchema>;

export const SeriesNotesFacetsViewSchema = z.object({
  ...noteCategoryFacetFields,
  authors: z
    .array(NoteAuthorFacetSchema)
    .describe(
      `Canonical authors of series holding a note of the scope; a series credits its notes to every canonical author. ${NOTE_FACET_SELF_EXCLUSION_RULE}`,
    ),
  genres: z
    .array(NoteValueFacetSchema)
    .describe(
      `Genre keys of series holding a note of the scope, with their note counts. ${NOTE_FACET_SELF_EXCLUSION_RULE}`,
    ),
  series: z
    .array(NoteSeriesFacetSchema)
    .describe(
      `Series holding a note of the scope, with their note counts. ${NOTE_FACET_SELF_EXCLUSION_RULE}`,
    ),
});

export type SeriesNotesFacetsView = z.infer<typeof SeriesNotesFacetsViewSchema>;

export const NotesSummaryAuthorSchema = z.object({
  leadersCount: z.number().int().positive(),
  name: z.string().nullable(),
  notesCount: CountSchema,
});

export type NotesSummaryAuthor = z.infer<typeof NotesSummaryAuthorSchema>;

export const BookNotesSummaryTopBookSchema = z.object({
  leadersCount: z.number().int().positive(),
  notesCount: CountSchema,
  title: z.string().nullable(),
});

export type BookNotesSummaryTopBook = z.infer<typeof BookNotesSummaryTopBookSchema>;

export const SeriesNotesSummaryTopSeriesSchema = z.object({
  leadersCount: z.number().int().positive(),
  name: z.string().nullable(),
  notesCount: CountSchema,
});

export type SeriesNotesSummaryTopSeries = z.infer<typeof SeriesNotesSummaryTopSeriesSchema>;

export const BookNotesSummaryViewSchema = z.object({
  bookNotesCount: CountSchema.describe("Active book notes on active books."),
  booksWithFiveOrMoreNotesCount: CountSchema.describe("Books holding at least five notes."),
  booksWithNotesCount: CountSchema.describe("Books holding at least one note."),
  createdLast30DaysCount: CountSchema.describe("Book notes created in the rolling last 30 days."),
  topAuthor: NotesSummaryAuthorSchema.nullable().describe(
    "Author whose books hold the most notes; name is null on a tie, the whole value is null without author data.",
  ),
  topBook: BookNotesSummaryTopBookSchema.nullable().describe(
    "Book holding the most notes; title is null on a tie, the whole value is null without notes.",
  ),
});

export type BookNotesSummaryView = z.infer<typeof BookNotesSummaryViewSchema>;

export const SeriesNotesSummaryViewSchema = z.object({
  createdLast30DaysCount: CountSchema.describe("Series notes created in the rolling last 30 days."),
  seriesNotesCount: CountSchema.describe("Active series notes on active series."),
  seriesWithNotesCount: CountSchema.describe("Series holding at least one note."),
  seriesWithThreeOrMoreNotesCount: CountSchema.describe("Series holding at least three notes."),
  topAuthor: NotesSummaryAuthorSchema.nullable().describe(
    "Canonical author whose series hold the most notes; name is null on a tie, the whole value is null without author data.",
  ),
  topSeries: SeriesNotesSummaryTopSeriesSchema.nullable().describe(
    "Series holding the most notes; name is null on a tie, the whole value is null without notes.",
  ),
});

export type SeriesNotesSummaryView = z.infer<typeof SeriesNotesSummaryViewSchema>;

export const NoteDeletionResultSchema = TrashDeletionResultSchema.extend({
  noteId: z.string(),
});

export type NoteDeletionResult = z.infer<typeof NoteDeletionResultSchema>;

export const TrashedNoteViewSchema = z.object({
  deletedAt: z.iso.datetime(),
  entityTitle: z.string().nullable(),
  entityType: NoteEntityTypeSchema,
  id: z.string(),
  purgeAt: z.iso.datetime(),
  text: z.string(),
});

export type TrashedNoteView = z.infer<typeof TrashedNoteViewSchema>;

export const TrashedNotesQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashedNotesQuery = z.infer<typeof TrashedNotesQuerySchema>;

export const PaginatedTrashedNotesSchema = createPaginatedSchema(TrashedNoteViewSchema);

export type PaginatedTrashedNotes = z.infer<typeof PaginatedTrashedNotesSchema>;

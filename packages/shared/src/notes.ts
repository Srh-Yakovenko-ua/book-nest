import { z } from "zod";

import { createPaginatedSchema, LIST_PAGE_SIZE_MAX } from "./common.js";
import { MediaViewSchema } from "./media.js";

const NOTE_TEXT_MAX = 5000;
const NOTE_CUSTOM_CATEGORY_MAX = 100;
const NOTE_CHAPTER_MAX = 100;
const NOTE_SEARCH_MAX = 100;
const NOTES_DEFAULT_PAGE_SIZE = 20;

export const NOTE_ERROR_CODES = {
  bookNotFound: "note_book_not_found",
  noteNotFound: "note_not_found",
  seriesNotFound: "note_series_not_found",
} as const;

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

export const NoteEntityFilterSchema = z.enum(["all", "book", "series"]);

export type NoteEntityFilter = z.infer<typeof NoteEntityFilterSchema>;

export const NoteSortSchema = z.enum([
  "newest",
  "oldest",
  "recently_updated",
  "title",
  "author",
  "category",
  "page",
  "pinned_first",
  "favorite_first",
  "no_spoiler_first",
  "with_spoiler_first",
]);

export type NoteSort = z.infer<typeof NoteSortSchema>;

export const CreateNoteInputSchema = z.object({
  category: NoteCategorySchema.nullish(),
  chapter: z.string().trim().max(NOTE_CHAPTER_MAX).nullish(),
  customCategory: z.string().trim().max(NOTE_CUSTOM_CATEGORY_MAX).nullish(),
  isFavorite: z.boolean().default(false),
  isPinned: z.boolean().default(false),
  isSpoiler: z.boolean().default(false),
  page: z.coerce.number().int().positive().nullish(),
  text: z.string().trim().min(1).max(NOTE_TEXT_MAX),
});

export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;

export const UpdateNoteInputSchema = z.object({
  category: NoteCategorySchema.nullish(),
  chapter: z.string().trim().max(NOTE_CHAPTER_MAX).nullish(),
  customCategory: z.string().trim().max(NOTE_CUSTOM_CATEGORY_MAX).nullish(),
  isFavorite: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  isSpoiler: z.boolean().optional(),
  page: z.coerce.number().int().positive().nullish(),
  text: z.string().trim().min(1).max(NOTE_TEXT_MAX).optional(),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteInputSchema>;

export const NotesQuerySchema = z.object({
  bookId: z.string().uuid().optional(),
  category: NoteCategorySchema.optional(),
  entityType: NoteEntityFilterSchema.default("all"),
  filter: NoteFilterSchema.default("all"),
  hasChapter: NoteBooleanQuerySchema.optional(),
  hasPage: NoteBooleanQuerySchema.optional(),
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(NOTES_DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(NOTE_SEARCH_MAX).optional(),
  seriesId: z.string().uuid().optional(),
  sort: NoteSortSchema.default("pinned_first"),
});

export type NotesQuery = z.infer<typeof NotesQuerySchema>;

export const NoteBookPreviewSchema = z.object({
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export type NoteBookPreview = z.infer<typeof NoteBookPreviewSchema>;

export const NoteSeriesPreviewSchema = z.object({
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

export const NotesSummaryViewSchema = z.object({
  bookNotesCount: z.number().int().nonnegative(),
  booksWithNotesCount: z.number().int().nonnegative(),
  favoriteCount: z.number().int().nonnegative(),
  pinnedCount: z.number().int().nonnegative(),
  seriesNotesCount: z.number().int().nonnegative(),
  seriesWithNotesCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  withoutSpoilerCount: z.number().int().nonnegative(),
  withSpoilerCount: z.number().int().nonnegative(),
});

export type NotesSummaryView = z.infer<typeof NotesSummaryViewSchema>;

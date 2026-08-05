import { z } from "zod";

import {
  collapseHorizontalSpaces,
  collapseSpaces,
  createPaginatedSchema,
  LIST_PAGE_SIZE_MAX,
  paginationQueryFields,
} from "./common.js";
import { NoHtmlString } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { TaxonomySearchPaginationQuerySchema } from "./taxonomy.js";
import { TRASH_PAGE_SIZE_DEFAULT, TrashDeletionResultSchema } from "./trash.js";

const LIST_NAME_MIN = 2;
const LIST_NAME_MAX = 80;
const LIST_DESCRIPTION_MAX = 300;

export const ListNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(LIST_NAME_MIN, "List name must be at least 2 characters long").max(
      LIST_NAME_MAX,
      "List name must be at most 80 characters long",
    ),
  );

export const ListDescriptionSchema = z
  .string()
  .transform(collapseHorizontalSpaces)
  .pipe(NoHtmlString.max(LIST_DESCRIPTION_MAX, "Description must be at most 300 characters long"));

export const NewListInputSchema = z.object({
  description: ListDescriptionSchema.optional(),
  name: ListNameSchema,
});

export type NewListInput = z.infer<typeof NewListInputSchema>;

export const UpdateListInputSchema = z.object({
  description: ListDescriptionSchema.optional(),
  name: ListNameSchema,
});

export type UpdateListInput = z.infer<typeof UpdateListInputSchema>;

export const BookListViewSchema = z.object({
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
});

export type BookListView = z.infer<typeof BookListViewSchema>;

export const CustomListCardSchema = z.object({
  bookCount: z.number(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  previewCovers: z.array(MediaViewSchema),
  updatedAt: z.string(),
});

export type CustomListCard = z.infer<typeof CustomListCardSchema>;

export const PaginatedCustomListsSchema = createPaginatedSchema(CustomListCardSchema);

export const ListsSummaryViewSchema = z.object({
  averageBooksPerList: z.number().int().nonnegative(),
  emptyListCount: z.number().int().nonnegative(),
  largestListBookCount: z.number().int().nonnegative(),
  listsWithBooksCount: z.number().int().nonnegative(),
  maxListsPerBook: z.number().int().nonnegative(),
  multiListBookCount: z.number().int().nonnegative(),
  totalListCount: z.number().int().nonnegative(),
  totalMembershipCount: z.number().int().nonnegative(),
  uniqueBookCount: z.number().int().nonnegative(),
});

export type ListsSummaryView = z.infer<typeof ListsSummaryViewSchema>;

export const ListSortSchema = z.enum([
  "updated_desc",
  "created_desc",
  "created_asc",
  "title_asc",
  "title_desc",
  "books_count_desc",
  "books_count_asc",
]);

export type ListSort = z.infer<typeof ListSortSchema>;

export const CustomListsQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  sort: ListSortSchema.default("updated_desc"),
});

export type CustomListsQuery = z.infer<typeof CustomListsQuerySchema>;

export const ListBookSortSchema = z.enum([
  "position",
  "added_desc",
  "added_asc",
  "title_asc",
  "title_desc",
  "author_asc",
  "rating_desc",
  "pages_desc",
  "pages_asc",
]);

export type ListBookSort = z.infer<typeof ListBookSortSchema>;

export const CustomListBooksQuerySchema = TaxonomySearchPaginationQuerySchema.extend({
  sort: ListBookSortSchema.default("position"),
});

export type CustomListBooksQuery = z.infer<typeof CustomListBooksQuerySchema>;

const ADD_BOOKS_TO_LIST_MAX = LIST_PAGE_SIZE_MAX;

export const AddBooksToListInputSchema = z.object({
  bookIds: z.array(z.uuid()).min(1).max(ADD_BOOKS_TO_LIST_MAX),
});

export type AddBooksToListInput = z.infer<typeof AddBooksToListInputSchema>;

export const AddBooksToListResultSchema = z.object({
  added: z.number().int().nonnegative(),
  bookCount: z.number().int().nonnegative(),
});

export type AddBooksToListResult = z.infer<typeof AddBooksToListResultSchema>;

export const MoveListBookDirectionSchema = z.enum(["up", "down"]);

export type MoveListBookDirection = z.infer<typeof MoveListBookDirectionSchema>;

export const MoveListBookInputSchema = z.object({
  direction: MoveListBookDirectionSchema,
});

export type MoveListBookInput = z.infer<typeof MoveListBookInputSchema>;

export const BookListMembershipViewSchema = z.object({
  bookCount: z.number().int().nonnegative(),
  id: z.string(),
  isMember: z.boolean(),
  name: z.string(),
});

export type BookListMembershipView = z.infer<typeof BookListMembershipViewSchema>;

export const BookListsViewSchema = z.object({
  lists: z.array(BookListMembershipViewSchema),
});

export type BookListsView = z.infer<typeof BookListsViewSchema>;

const SET_BOOK_LISTS_MAX = LIST_PAGE_SIZE_MAX;

export const SetBookListsInputSchema = z.object({
  listIds: z.array(z.uuid()).max(SET_BOOK_LISTS_MAX),
});

export type SetBookListsInput = z.infer<typeof SetBookListsInputSchema>;

export const ListDeletionResultSchema = TrashDeletionResultSchema.extend({
  listId: z.string(),
});

export type ListDeletionResult = z.infer<typeof ListDeletionResultSchema>;

export const TrashedListViewSchema = z.object({
  bookCount: z.number().int(),
  deletedAt: z.iso.datetime(),
  id: z.string(),
  name: z.string(),
  purgeAt: z.iso.datetime(),
});

export type TrashedListView = z.infer<typeof TrashedListViewSchema>;

export const TrashedListsQuerySchema = z.object({
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashedListsQuery = z.infer<typeof TrashedListsQuerySchema>;

export const PaginatedTrashedListsSchema = createPaginatedSchema(TrashedListViewSchema);

export type PaginatedTrashedLists = z.infer<typeof PaginatedTrashedListsSchema>;

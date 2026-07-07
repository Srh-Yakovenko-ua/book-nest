import { z } from "zod";

import { collapseHorizontalSpaces, collapseSpaces, createPaginatedSchema } from "./common.js";
import { NoHtmlString } from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { TaxonomySearchPaginationQuerySchema } from "./taxonomy.js";

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

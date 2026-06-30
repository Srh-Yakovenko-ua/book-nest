import type { BookAuthorReference } from "@app/shared";

import { z } from "zod";

import type {
  AuthorSelection,
  CreateBookFormValues,
  PublisherSelection,
  SeriesSelection,
} from "./create-book-form";

type BookFormDraft = {
  authorSelections: AuthorSelection[];
  locale: string;
  publisherSelection: null | PublisherSelection;
  seriesSelection: null | SeriesSelection;
  values: CreateBookFormValues;
};

const authorSelectionSchema = z.union([
  z.object({ id: z.string(), kind: z.literal("catalog"), name: z.string() }),
  z.object({ kind: z.literal("custom"), name: z.string() }),
]) satisfies z.ZodType<AuthorSelection>;

const publisherSelectionSchema = z.union([
  z.object({ id: z.string(), kind: z.literal("catalog"), name: z.string() }),
  z.object({ kind: z.literal("custom"), name: z.string() }),
]) satisfies z.ZodType<PublisherSelection>;

const authorReferenceSchema = z.union([
  z.object({ id: z.string() }),
  z.object({ openLibraryKey: z.string() }),
  z.object({ name: z.string() }),
]) satisfies z.ZodType<BookAuthorReference>;

const newSeriesDraftSchema = z.object({
  authors: z.array(authorReferenceSchema).optional(),
  description: z.string().optional(),
  name: z.string(),
  status: z.enum(["completed", "ongoing", "unknown"]),
  totalBooks: z.number().optional(),
});

const seriesSelectionSchema = z.union([
  z.object({
    authors: z.array(authorSelectionSchema),
    draft: newSeriesDraftSchema,
    kind: z.literal("new"),
    name: z.string(),
  }),
  z.object({
    authors: z.array(authorSelectionSchema),
    id: z.string(),
    kind: z.literal("existing"),
    name: z.string(),
    totalBooks: z.number().optional(),
  }),
]) satisfies z.ZodType<SeriesSelection>;

const draftSchema = z.object({
  authorSelections: z.array(authorSelectionSchema),
  locale: z.string(),
  publisherSelection: publisherSelectionSchema.nullable(),
  seriesSelection: seriesSelectionSchema.nullable(),
  values: z.record(z.string(), z.unknown()),
});

export function readBookFormDraft(storageKey: string, locale: string): BookFormDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(storageKey);
  if (raw === null) return null;
  const draft = parseBookFormDraft(raw);
  if (draft === null || draft.locale === locale) return null;
  return draft;
}

function parseBookFormDraft(raw: string): BookFormDraft | null {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }

  const parsed = draftSchema.safeParse(json);
  if (!parsed.success) return null;

  return {
    authorSelections: parsed.data.authorSelections,
    locale: parsed.data.locale,
    publisherSelection: parsed.data.publisherSelection,
    seriesSelection: parsed.data.seriesSelection,
    values: parsed.data.values as CreateBookFormValues,
  };
}

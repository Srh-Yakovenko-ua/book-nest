import type { BookAuthorReference, Nullable } from "@app/shared";

import {
  ActiveShipmentStatusSchema,
  AgeCategorySchema,
  BookFormatSchema,
  BookLanguageSchema,
  BookTypeSchema,
  CurrencySchema,
  OwnershipStatusSchema,
  QueuePriorityReasonSchema,
  QueuePrioritySchema,
  ReadingStatusSchema,
  SeriesStatusSchema,
} from "@app/shared";
import { z } from "zod";

import type { LoanContactSelection } from "@/features/loans";

import type {
  AuthorSelection,
  CreateBookFormValues,
  PublisherSelection,
  SeriesSelection,
} from "./create-book-form";

type BookFormDraft = {
  authorSelections: AuthorSelection[];
  bookUpdatedAt: Nullable<string>;
  loanContactSelection: LoanContactSelection | null;
  locale: string;
  publisherEdited: boolean;
  publisherQuery: string;
  publisherSelection: null | PublisherSelection;
  seriesSelection: null | SeriesSelection;
  values: Partial<CreateBookFormValues>;
};

const authorSelectionSchema = z.union([
  z.object({ id: z.string(), kind: z.literal("catalog"), name: z.string() }),
  z.object({ kind: z.literal("custom"), name: z.string() }),
]) satisfies z.ZodType<AuthorSelection>;

const publisherSelectionSchema = z.union([
  z.object({ id: z.string(), kind: z.literal("catalog"), name: z.string() }),
  z.object({ kind: z.literal("custom"), name: z.string() }),
]) satisfies z.ZodType<PublisherSelection>;

const loanContactSelectionSchema = z.union([
  z.object({ contactId: z.string(), kind: z.literal("picked"), name: z.string() }),
  z.object({ kind: z.literal("saved"), name: z.string() }),
]) satisfies z.ZodType<LoanContactSelection>;

const authorReferenceSchema = z.union([
  z.object({ id: z.string() }),
  z.object({ openLibraryKey: z.string() }),
  z.object({ name: z.string() }),
]) satisfies z.ZodType<BookAuthorReference>;

const newSeriesDraftSchema = z.object({
  authors: z.array(authorReferenceSchema).optional(),
  description: z.string().optional(),
  genres: z.array(z.string()).default([]),
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
    commonGenres: z.array(z.string()).default([]),
    dominantPublisher: z
      .object({ bookCount: z.number(), id: z.string(), name: z.string() })
      .nullable()
      .default(null),
    genres: z.array(z.string()).default([]),
    id: z.string(),
    kind: z.literal("existing"),
    name: z.string(),
    totalBooks: z.number().optional(),
  }),
]) satisfies z.ZodType<SeriesSelection>;

const draftSchema = z.object({
  authorSelections: z.array(authorSelectionSchema),
  bookUpdatedAt: z.string().nullable().default(null),
  loanContactSelection: loanContactSelectionSchema.nullable().default(null),
  locale: z.string(),
  publisherEdited: z.boolean().default(false),
  publisherQuery: z.string().default(""),
  publisherSelection: publisherSelectionSchema.nullable(),
  seriesSelection: seriesSelectionSchema.nullable(),
  values: z.record(z.string(), z.unknown()),
});

const draftValueShape = {
  addToReadingQueue: z.boolean(),
  ageCategory: AgeCategorySchema,
  authors: z.array(authorReferenceSchema),
  bookType: BookTypeSchema,
  coverMediaId: z.string().nullable(),
  dedication: z.string().nullable(),
  deliveryInfo: z
    .object({
      currency: CurrencySchema,
      deliveryService: z.string().nullable(),
      deliveryStatus: ActiveShipmentStatusSchema,
      expectedDeliveryDate: z.string().nullable(),
      isFree: z.boolean(),
      isShipped: z.boolean(),
      note: z.string().nullable(),
      orderDate: z.string().nullable(),
      orderNumber: z.string().nullable(),
      price: z.number().nullable(),
      storeName: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      trackingUrl: z.string().nullable(),
    })
    .partial(),
  description: z.string().nullable(),
  formats: z.array(BookFormatSchema),
  genres: z.array(z.string()),
  illustrator: z.string().nullable(),
  isbn: z.string().nullable(),
  isFavorite: z.boolean(),
  language: BookLanguageSchema,
  listIds: z.array(z.string()),
  loanInfo: z
    .object({
      expectedReturnDate: z.string().nullable(),
      loanContactId: z.string(),
      loanDate: z.string().nullable(),
      note: z.string().nullable(),
      personName: z.string(),
    })
    .partial(),
  newLists: z.array(z.object({ description: z.string().optional(), name: z.string() })),
  newSeries: z.object({
    authors: z.array(authorReferenceSchema).optional(),
    description: z.string().optional(),
    genres: z.array(z.string()).optional(),
    name: z.string(),
    status: SeriesStatusSchema.optional(),
    totalBooks: z.number().optional(),
  }),
  originalTitle: z.string().nullable(),
  ownershipStatus: OwnershipStatusSchema,
  pagesCount: z.number().nullable(),
  partNumber: z.number(),
  publicationYear: z.number().nullable(),
  publisherId: z.string(),
  publisherName: z.string(),
  purchaseInfo: z
    .object({
      currency: CurrencySchema.nullable(),
      expectedPrice: z.number().nullable(),
      note: z.string().nullable(),
      storeName: z.string().nullable(),
      storeUrl: z.string().nullable(),
    })
    .partial(),
  queuePriority: QueuePrioritySchema,
  queuePriorityReason: QueuePriorityReasonSchema.nullable(),
  queuePriorityReasonCustomText: z.string().nullable(),
  queuePriorityTargetDate: z.string().nullable(),
  readingProgress: z
    .object({
      abandonedAt: z.string().nullable(),
      currentPage: z.number().nullable(),
      finishedAt: z.string().nullable(),
      impression: z.string().nullable(),
      note: z.string().nullable(),
      pausedAt: z.string().nullable(),
      rating: z.number().nullable(),
      startedAt: z.string().nullable(),
    })
    .partial(),
  readingStatus: ReadingStatusSchema,
  seriesId: z.string(),
  tags: z.array(z.string()),
  title: z.string(),
  translator: z.string().nullable(),
} satisfies Record<keyof CreateBookFormValues, z.ZodType>;

const draftValuesSchema = z.object(draftValueShape).partial() satisfies z.ZodType<
  Partial<CreateBookFormValues>
>;
const draftValueFieldSchemas: Record<string, undefined | z.ZodType> = draftValuesSchema.shape;

type DraftValueField = keyof typeof draftValuesSchema.shape;

const DRAFT_STORAGE = {
  prefix: "book-form-draft:",
  userScopePrefix: "book-form-draft:user:",
} as const;

export function bookFormDraftKey({
  bookId,
  userId,
}: {
  bookId: Nullable<string>;
  userId: Nullable<string>;
}): Nullable<string> {
  if (userId === null) return null;
  const formScope = bookId === null ? "create" : `edit:${bookId}`;
  return `${ownedDraftPrefix(userId)}${formScope}`;
}

export function clearBookFormDraft(storageKey: Nullable<string>) {
  if (storageKey === null) return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
}

export function clearBookFormDraftsNotOwnedBy(userId: string) {
  const ownPrefix = ownedDraftPrefix(userId);
  removeStoredDrafts((draftKey) => !draftKey.startsWith(ownPrefix));
}

export function clearLegacyBookFormDrafts() {
  removeStoredDrafts((draftKey) => !draftKey.startsWith(DRAFT_STORAGE.userScopePrefix));
}

export function readBookFormDraft({
  bookUpdatedAt,
  locale,
  storageKey,
}: {
  bookUpdatedAt: Nullable<string>;
  locale: string;
  storageKey: Nullable<string>;
}): BookFormDraft | null {
  const raw = readStoredDraft(storageKey);
  if (raw === null) return null;
  const draft = parseBookFormDraft(raw);
  if (draft === null) return null;
  if (draft.bookUpdatedAt !== bookUpdatedAt) {
    clearBookFormDraft(storageKey);
    return null;
  }
  if (draft.locale === locale) return null;
  return draft;
}

export function writeBookFormDraft({
  draft,
  storageKey,
}: {
  draft: BookFormDraft;
  storageKey: Nullable<string>;
}) {
  if (storageKey === null) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    return;
  }
}

function isDraftValueField(field: string): field is DraftValueField {
  return Object.hasOwn(draftValuesSchema.shape, field);
}

function ownedDraftPrefix(userId: string) {
  return `${DRAFT_STORAGE.userScopePrefix}${userId}:`;
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
    bookUpdatedAt: parsed.data.bookUpdatedAt,
    loanContactSelection: parsed.data.loanContactSelection,
    locale: parsed.data.locale,
    publisherEdited: parsed.data.publisherEdited,
    publisherQuery: parsed.data.publisherQuery,
    publisherSelection: parsed.data.publisherSelection,
    seriesSelection: parsed.data.seriesSelection,
    values: parseDraftValues(parsed.data.values),
  };
}

function parseDraftValues(values: Record<string, unknown>): Partial<CreateBookFormValues> {
  const wellShapedFields: { [Field in DraftValueField]?: true } = {};
  for (const [field, value] of Object.entries(values)) {
    if (isDraftValueField(field) && draftValueFieldSchemas[field]?.safeParse(value).success) {
      wellShapedFields[field] = true;
    }
  }
  const parsed = draftValuesSchema.pick(wellShapedFields).safeParse(values);
  return parsed.success ? parsed.data : {};
}

function readStoredDraft(storageKey: Nullable<string>): null | string {
  if (storageKey === null || typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function removeStoredDrafts(shouldRemove: (draftKey: string) => boolean) {
  try {
    const storage = window.sessionStorage;
    const storedKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of storedKeys) {
      if (key === null || !key.startsWith(DRAFT_STORAGE.prefix)) continue;
      if (shouldRemove(key)) storage.removeItem(key);
    }
  } catch {
    return;
  }
}

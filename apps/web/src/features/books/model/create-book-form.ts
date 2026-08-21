import {
  type BookAuthorReference,
  CreateBookInputSchema,
  NewSeriesInputSchema,
  UpdateBookInputSchema,
} from "@app/shared";
import { z } from "zod";

import { validateQueuePriority } from "./queue-priority";

export { CreateBookInputSchema, NewSeriesInputSchema, UpdateBookInputSchema };

export const CreateBookFormSchema = CreateBookInputSchema.superRefine(validateQueuePriority);

export const UpdateBookFormSchema = UpdateBookInputSchema.superRefine(validateQueuePriority);

export type AuthorSelection =
  { id: string; kind: "catalog"; name: string } | { kind: "custom"; name: string };

export type BookFormInitialSeries = {
  partNumber?: number;
  selection: Extract<SeriesSelection, { kind: "existing" }>;
};

export type CreateBookFormOutput = z.output<typeof CreateBookInputSchema>;

export type CreateBookFormValues = z.input<typeof CreateBookInputSchema>;

export type PublisherSelection =
  { id: string; kind: "catalog"; name: string } | { kind: "custom"; name: string };

export type SeriesPartNumberConflict = {
  bookId: string;
  bookTitle: string;
  partNumber: number;
};

export type SeriesSelection =
  | { authors: AuthorSelection[]; draft: NewSeriesDraft; kind: "new"; name: string }
  | {
      authors: AuthorSelection[];
      genres: string[];
      id: string;
      kind: "existing";
      name: string;
      totalBooks?: number;
    };

type NewSeriesDraft = {
  authors?: BookAuthorReference[];
  description?: string;
  genres: string[];
  name: string;
  status: "completed" | "ongoing" | "unknown";
  totalBooks?: number;
};

export function authorSelectionKey(selection: AuthorSelection): string {
  return selection.kind === "catalog"
    ? `id:${selection.id}`
    : `name:${selection.name.trim().toLowerCase()}`;
}

export function authorSelectionToReference(selection: AuthorSelection): BookAuthorReference {
  if (selection.kind === "catalog") {
    return { id: selection.id };
  }
  return { name: selection.name };
}

export const createBookFormDefaults = {
  addToReadingQueue: false,
  ageCategory: "not_specified",
  authors: [],
  bookType: "solo",
  deliveryInfo: { currency: "UAH", deliveryStatus: "ordered", isShipped: false },
  formats: ["paper"],
  genres: [],
  isFavorite: false,
  language: "ukrainian",
  loanInfo: {},
  ownershipStatus: "none",
  purchaseInfo: { currency: "UAH" },
  queuePriorityReason: null,
  queuePriorityReasonCustomText: null,
  queuePriorityTargetDate: null,
  readingProgress: {},
  readingStatus: "not_started",
  tags: [],
  title: "",
} satisfies Partial<CreateBookFormValues>;

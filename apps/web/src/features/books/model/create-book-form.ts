import {
  type BookAuthorReference,
  CreateBookInputSchema,
  NewSeriesInputSchema,
  UpdateBookInputSchema,
} from "@app/shared";
import { z } from "zod";

export { CreateBookInputSchema, NewSeriesInputSchema, UpdateBookInputSchema };

export type AuthorSelection =
  | { id: string; kind: "catalog"; name: string }
  | { kind: "custom"; name: string };

export type CreateBookFormOutput = z.output<typeof CreateBookInputSchema>;

export type CreateBookFormValues = z.input<typeof CreateBookInputSchema>;

export type PublisherSelection =
  | { id: string; kind: "catalog"; name: string }
  | { kind: "custom"; name: string };

export type SeriesPartNumberConflict = {
  bookId: string;
  bookTitle: string;
  partNumber: number;
};

export type SeriesSelection =
  | { draft: NewSeriesDraft; kind: "new"; name: string }
  | { id: string; kind: "existing"; name: string; totalBooks?: number };

type NewSeriesDraft = {
  description?: string;
  name: string;
  status: "completed" | "ongoing" | "unknown";
  totalBooks?: number;
};

export function authorSelectionToReference(selection: AuthorSelection): BookAuthorReference {
  if (selection.kind === "catalog") {
    return { id: selection.id };
  }
  return { name: selection.name };
}

export const createBookFormDefaults = {
  addToReadingQueue: false,
  ageCategory: "not_specified",
  author: { name: "" },
  bookType: "solo",
  deliveryInfo: {},
  formats: ["paper"],
  genres: [],
  isFavorite: false,
  language: "ukrainian",
  loanInfo: {},
  ownershipStatus: "none",
  purchaseInfo: { currency: "UAH" },
  readingProgress: {},
  readingStatus: "not_started",
  tags: [],
  title: "",
} satisfies Partial<CreateBookFormValues>;

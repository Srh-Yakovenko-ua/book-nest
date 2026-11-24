import type {
  BookNotesOverviewView,
  NoteMemoryBookSource,
  NoteMemoryView,
  Nullable,
  QuotesOverviewView,
  QuoteView,
} from "@app/shared";

import { differenceInCalendarDays } from "date-fns";

import { assertNever } from "@/lib/assert-never";
import { parseIsoDay } from "@/lib/format";

import type { HomePresence } from "./home-onboarding";

export type HomeMemoryKind = "note" | "quote";

export type HomeMemorySelection =
  | { kind: "error" }
  | { kind: "hidden" }
  | { kind: "loading" }
  | { kind: "note"; memory: HomeNoteMemory }
  | { kind: "quote"; quote: QuoteView };

export type HomeMemorySource<TItem> =
  { item: Nullable<TItem>; status: "success" } | { status: "error" } | { status: "pending" };

export type HomeNoteMemory = Omit<NoteMemoryView, "source"> & {
  source: NoteMemoryBookSource;
};

type HomeMemoryCandidate =
  | { selection: HomeMemoryShown; status: "present" }
  | { status: "absent" }
  | { status: "error" }
  | { status: "pending" };

type HomeMemoryShown = Extract<HomeMemorySelection, { kind: HomeMemoryKind }>;

type MemoryQuery<TData> = {
  data: TData | undefined;
  isError: boolean;
};

const HOME_MEMORY = {
  epochDay: "2026-01-01",
} as const;

export function bookMemoryNote(
  overview: Pick<BookNotesOverviewView, "memoryNote">,
): Nullable<HomeNoteMemory> {
  const memory = overview.memoryNote;
  if (memory === null) return null;

  const { source } = memory;
  if (source.type !== "book") return null;
  return { ...memory, source };
}

export function homeMemoryPresence(selection: HomeMemorySelection): HomePresence {
  switch (selection.kind) {
    case "error":
    case "loading":
      return "unknown";
    case "hidden":
      return "absent";
    case "note":
    case "quote":
      return "present";
    default:
      return assertNever(selection);
  }
}

export function memoryKindForDay(today: string): HomeMemoryKind {
  const dayIndex = differenceInCalendarDays(parseIsoDay(today), parseIsoDay(HOME_MEMORY.epochDay));
  return Math.abs(dayIndex % 2) === 0 ? "quote" : "note";
}

export function memorySourceFromQuery<TData, TItem>({
  pick,
  query,
}: {
  pick: (data: TData) => Nullable<TItem>;
  query: MemoryQuery<TData>;
}): HomeMemorySource<TItem> {
  if (query.data !== undefined) return { item: pick(query.data), status: "success" };
  if (query.isError) return { status: "error" };
  return { status: "pending" };
}

export function quoteMemory(overview: QuotesOverviewView): Nullable<QuoteView> {
  return overview.memoryQuote;
}

export function selectHomeMemory({
  note,
  quote,
  today,
}: {
  note: HomeMemorySource<HomeNoteMemory>;
  quote: HomeMemorySource<QuoteView>;
  today: string;
}): HomeMemorySelection {
  const quoteCandidate = toCandidate({
    show: (item) => ({ kind: "quote", quote: item }),
    source: quote,
  });
  const noteCandidate = toCandidate({
    show: (item) => ({ kind: "note", memory: item }),
    source: note,
  });
  const [preferred, fallback]: readonly [HomeMemoryCandidate, HomeMemoryCandidate] =
    memoryKindForDay(today) === "quote"
      ? [quoteCandidate, noteCandidate]
      : [noteCandidate, quoteCandidate];

  if (preferred.status === "present") return preferred.selection;
  if (preferred.status === "pending") return { kind: "loading" };
  if (fallback.status === "present") return fallback.selection;
  if (fallback.status === "pending") return { kind: "loading" };
  if (preferred.status === "absent" && fallback.status === "absent") return { kind: "hidden" };
  return { kind: "error" };
}

function toCandidate<TItem>({
  show,
  source,
}: {
  show: (item: TItem) => HomeMemoryShown;
  source: HomeMemorySource<TItem>;
}): HomeMemoryCandidate {
  switch (source.status) {
    case "error":
      return { status: "error" };
    case "pending":
      return { status: "pending" };
    case "success":
      return source.item === null
        ? { status: "absent" }
        : { selection: show(source.item), status: "present" };
    default:
      return assertNever(source);
  }
}

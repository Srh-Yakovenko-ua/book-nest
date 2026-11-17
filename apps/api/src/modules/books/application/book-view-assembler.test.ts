import type { Mock } from "vitest";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MediaService } from "../../media/application/media.service.js";
import type { UserSettingsContextService } from "../../profile/index.js";
import type { BooksRepository, BookWithRelations } from "../infrastructure/books.repository.js";

import { fakeOf } from "../../../test/fake.js";
import { BookViewAssembler } from "./book-view-assembler.js";

type LoanRow = BookWithRelations["loans"][number];

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOOK_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const LOAN_CONTACT_ID = "44444444-4444-4444-8444-444444444444";

const KYIV_PAST_MIDNIGHT = Object.freeze({
  dueDate: new Date("2026-11-14T00:00:00.000Z"),
  instant: new Date("2026-11-14T22:30:00.000Z"),
  kyivDay: new Date("2026-11-15T00:00:00.000Z"),
  utcDay: new Date("2026-11-14T00:00:00.000Z"),
});

function bookRow(overrides: Partial<BookWithRelations> = {}): BookWithRelations {
  return {
    _count: { orderItems: 0 },
    ageCategory: "not_specified",
    authors: [
      {
        author: { id: AUTHOR_ID, name: "Frank Herbert", normalizedName: "frank herbert" },
        authorId: AUTHOR_ID,
        bookId: BOOK_ID,
        position: 0,
      },
    ] as BookWithRelations["authors"],
    coverMedia: null,
    coverMediaId: null,
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    dedication: null,
    description: null,
    favoriteAddedAt: null,
    firstAuthorName: "Frank Herbert",
    formats: [],
    genres: [],
    id: BOOK_ID,
    illustrator: null,
    isbn: null,
    isFavorite: false,
    isFavoriteDedication: false,
    language: "ukrainian",
    lists: [],
    loans: [],
    orderItems: [],
    originalTitle: null,
    ownershipStatus: "borrowed_from_someone",
    pagesCount: null,
    pagesCountUnavailable: false,
    partNumber: null,
    publicationYear: null,
    publisher: null,
    publisherId: null,
    purchaseInfo: null,
    queuePosition: null,
    queuePriority: null,
    queuePriorityReason: null,
    queuePriorityReasonCustomText: null,
    queuePriorityTargetDate: null,
    readingProgress: null,
    readingStatus: "not_started",
    series: null,
    seriesId: null,
    tags: [],
    title: "Dune",
    translator: null,
    updatedAt: new Date("2026-02-02T11:00:00.000Z"),
    userId: USER_ID,
    wishlistAddedAt: null,
    ...overrides,
  } as BookWithRelations;
}

function buildAssembler({
  calendarDay,
  findOwnedByIdOrThrow = vi.fn().mockResolvedValue(bookRow()),
}: {
  calendarDay: Mock;
  findOwnedByIdOrThrow?: Mock;
}): BookViewAssembler {
  return new BookViewAssembler(
    fakeOf<BooksRepository>({ findOwnedByIdOrThrow }),
    fakeOf<MediaService>({ buildViewOrNull: vi.fn().mockReturnValue(null) }),
    fakeOf<UserSettingsContextService>({ calendarDay }),
  );
}

function loanDueOn(expectedReturnDate: Date): LoanRow {
  return {
    bookId: BOOK_ID,
    contact: null,
    createdAt: new Date("2026-11-01T10:00:00.000Z"),
    expectedReturnDate,
    id: "55555555-5555-4555-8555-555555555555",
    loanContact: {
      archivedAt: null,
      contact: null,
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      id: LOAN_CONTACT_ID,
      name: "Olha",
      normalizedName: "olha",
      updatedAt: new Date("2026-11-01T10:00:00.000Z"),
      userId: USER_ID,
    },
    loanContactId: LOAN_CONTACT_ID,
    loanDate: new Date("2026-11-01T00:00:00.000Z"),
    note: null,
    personName: "Olha",
    remindBeforeDays: null,
    remindToReturn: false,
    returnedAt: null,
    status: "active",
    type: "borrowed_from_someone",
    updatedAt: new Date("2026-11-01T10:00:00.000Z"),
    userId: USER_ID,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(KYIV_PAST_MIDNIGHT.instant);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BookViewAssembler.forUser", () => {
  it("resolves the reader's calendar day once however many books it maps", async () => {
    const calendarDay = vi.fn().mockResolvedValue(KYIV_PAST_MIDNIGHT.kyivDay);
    const assembler = buildAssembler({ calendarDay });

    const toBookView = await assembler.forUser(USER_ID);
    const views = [
      bookRow({ id: "book-a" }),
      bookRow({ id: "book-b" }),
      bookRow({ id: "book-c" }),
    ].map((book) => toBookView(book));

    expect(views.map((view) => view.id)).toEqual(["book-a", "book-b", "book-c"]);
    expect(calendarDay).toHaveBeenCalledTimes(1);
  });

  it("asks for the calendar day of the given reader at the current instant", async () => {
    const calendarDay = vi.fn().mockResolvedValue(KYIV_PAST_MIDNIGHT.kyivDay);
    const assembler = buildAssembler({ calendarDay });

    await assembler.forUser(USER_ID);

    expect(calendarDay).toHaveBeenCalledWith({ now: KYIV_PAST_MIDNIGHT.instant, userId: USER_ID });
  });

  it("marks a loan due 2026-11-14 overdue for a Kyiv reader already on 2026-11-15", async () => {
    const assembler = buildAssembler({
      calendarDay: vi.fn().mockResolvedValue(KYIV_PAST_MIDNIGHT.kyivDay),
    });

    const toBookView = await assembler.forUser(USER_ID);
    const view = toBookView(bookRow({ loans: [loanDueOn(KYIV_PAST_MIDNIGHT.dueDate)] }));

    expect(view.loanInfo?.loanUiStatus).toBe("overdue");
  });

  it("marks a loan due 2026-11-14 return soon for a UTC reader still on 2026-11-14", async () => {
    const assembler = buildAssembler({
      calendarDay: vi.fn().mockResolvedValue(KYIV_PAST_MIDNIGHT.utcDay),
    });

    const toBookView = await assembler.forUser(USER_ID);
    const view = toBookView(bookRow({ loans: [loanDueOn(KYIV_PAST_MIDNIGHT.dueDate)] }));

    expect(view.loanInfo?.loanUiStatus).toBe("return_soon");
  });
});

describe("BookViewAssembler.loadView", () => {
  it("marks a loan due 2026-11-14 overdue for a Kyiv reader already on 2026-11-15", async () => {
    const book = bookRow({ loans: [loanDueOn(KYIV_PAST_MIDNIGHT.dueDate)] });
    const assembler = buildAssembler({
      calendarDay: vi.fn().mockResolvedValue(KYIV_PAST_MIDNIGHT.kyivDay),
      findOwnedByIdOrThrow: vi.fn().mockResolvedValue(book),
    });

    const view = await assembler.loadView({ bookId: BOOK_ID, userId: USER_ID });

    expect(view.loanInfo?.loanUiStatus).toBe("overdue");
  });
});

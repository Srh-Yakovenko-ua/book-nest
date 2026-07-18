import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { LoansModule } from "../loans.module.js";

const DAY_MS = 1000 * 60 * 60 * 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isoDay = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);

let context: AuthTestContext;
let app: INestApplication;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, LoansModule]);
  app = context.app;
});

beforeEach(() => {
  context.reset();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function borrowCustomBook(
  accessToken: string,
  book: Record<string, unknown>,
  personName: string,
): Promise<void> {
  const created = await createBook(accessToken, book);
  await startLoan(accessToken, created.body.id, {
    direction: "borrowed",
    loanDate: isoDay(0),
    personName,
  });
}

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

async function createBorrowedLoan(
  accessToken: string,
  loan: Record<string, unknown>,
  title = "Dune",
): Promise<string> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "none",
    title,
  });
  await startLoan(accessToken, created.body.id, {
    direction: "borrowed",
    loanDate: isoDay(0),
    ...loan,
  });
  return created.body.id;
}

async function createLentLoan(
  accessToken: string,
  loan: Record<string, unknown>,
  title = "Hyperion",
): Promise<string> {
  const created = await createBook(accessToken, {
    authors: [{ name: "Dan Simmons" }],
    ownershipStatus: "owned",
    title,
  });
  await startLoan(accessToken, created.body.id, {
    direction: "lent",
    loanDate: isoDay(0),
    ...loan,
  });
  return created.body.id;
}

function listLoans(accessToken: string, queryString = ""): request.Test {
  return request(app.getHttpServer())
    .get(`/api/loans${queryString}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function loanSummary(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/loans/summary")
    .set("Authorization", `Bearer ${accessToken}`);
}

function startLoan(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

describe("GET /api/loans authorization", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans");

    expect(res.status).toBe(401);
  });

  it("returns 401 for the summary without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/summary");

    expect(res.status).toBe(401);
  });
});

describe("GET /api/loans", () => {
  it("returns an empty page when the user has no loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.totalCount).toBe(0);
  });

  it("lists active loans with a book preview and computed ui status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(3), personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    const item = res.body.items[0];
    expect(item.type).toBe("borrowed_from_someone");
    expect(item.personName).toBe("Olha");
    expect(item.loanUiStatus).toBe("return_soon");
    expect(item.book).toMatchObject({
      firstAuthorName: "Frank Herbert",
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });
  });

  it("does not list a loan that has been returned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, { personName: "Olha" });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("does not expose another user's loans", async () => {
    const owner = await context.registerVerifyAndLogin();
    await createBorrowedLoan(owner.accessToken, { personName: "Olha" });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await listLoans(stranger.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("filters by loan type through the type tab", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });
    await createLentLoan(accessToken, { personName: "Ivan" });

    const borrowed = await listLoans(accessToken, "?type=borrowed_from_someone");
    const lent = await listLoans(accessToken, "?type=lent_to_someone");

    expect(borrowed.body.items).toHaveLength(1);
    expect(borrowed.body.items[0].type).toBe("borrowed_from_someone");
    expect(lent.body.items).toHaveLength(1);
    expect(lent.body.items[0].type).toBe("lent_to_someone");
  });

  it("filters overdue loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-5), loanDate: isoDay(-20), personName: "Olha" },
      "Overdue Book",
    );
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Ivan" });

    const res = await listLoans(accessToken, "?filter=overdue");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].loanUiStatus).toBe("overdue");
    expect(res.body.items[0].book.title).toBe("Overdue Book");
  });

  it("filters loans without a return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "No Date Book");
    await createLentLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Ivan" });

    const res = await listLoans(accessToken, "?filter=no_return_date");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].loanUiStatus).toBe("no_return_date");
    expect(res.body.items[0].book.title).toBe("No Date Book");
  });

  it("filters loans with a reminder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(3),
      personName: "Olha",
      remindToReturn: true,
    });
    await createLentLoan(accessToken, { personName: "Ivan" });

    const res = await listLoans(accessToken, "?filter=has_reminder");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].remindToReturn).toBe(true);
  });

  it("searches by person name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha Melnyk" });
    await createLentLoan(accessToken, { personName: "Ivan Petrenko" });

    const res = await listLoans(accessToken, "?search=melnyk");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha Melnyk");
  });

  it("searches by book title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "The Left Hand of Darkness");
    await createLentLoan(accessToken, { personName: "Ivan" }, "Hyperion");

    const res = await listLoans(accessToken, "?search=left hand");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("The Left Hand of Darkness");
  });
});

describe("GET /api/loans/summary", () => {
  it("returns zeroed counts when there are no loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await loanSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      borrowedCount: 0,
      lentCount: 0,
      overdueCount: 0,
      returnThisWeek: 0,
      withoutReturnDate: 0,
      withReminder: 0,
    });
  });

  it("counts active loans by type, overdue, reminder and missing return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-20), personName: "Olha" },
      "Overdue",
    );
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "No Date");
    await createLentLoan(accessToken, {
      expectedReturnDate: isoDay(30),
      personName: "Ivan",
      remindToReturn: true,
    });

    const res = await loanSummary(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.borrowedCount).toBe(2);
    expect(res.body.lentCount).toBe(1);
    expect(res.body.overdueCount).toBe(1);
    expect(res.body.withReminder).toBe(1);
    expect(res.body.withoutReturnDate).toBe(1);
  });

  it("counts a loan due today under returnThisWeek", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(0), personName: "Olha" });

    const res = await loanSummary(accessToken);

    expect(res.body.returnThisWeek).toBeGreaterThanOrEqual(1);
  });

  it("does not count a loan due next week under returnThisWeek", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(8), personName: "Olha" });

    const res = await loanSummary(accessToken);

    expect(res.body.returnThisWeek).toBe(0);
  });

  it("excludes a loan without a return date from overdue and returnThisWeek but counts it as missing a date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });

    const res = await loanSummary(accessToken);

    expect(res.body.overdueCount).toBe(0);
    expect(res.body.returnThisWeek).toBe(0);
    expect(res.body.withoutReturnDate).toBe(1);
  });

  it("excludes a returned loan from every count", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await createBorrowedLoan(accessToken, {
      expectedReturnDate: isoDay(3),
      personName: "Olha",
      remindToReturn: true,
    });
    await request(app.getHttpServer())
      .post(`/api/books/${bookId}/loan/return`)
      .set("Authorization", `Bearer ${accessToken}`);

    const res = await loanSummary(accessToken);

    expect(res.body).toEqual({
      borrowedCount: 0,
      lentCount: 0,
      overdueCount: 0,
      returnThisWeek: 0,
      withoutReturnDate: 0,
      withReminder: 0,
    });
  });
});

describe("GET /api/loans sorting", () => {
  it("sorts by person name ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Carol" }, "Book C");
    await createBorrowedLoan(accessToken, { personName: "Alice" }, "Book A");
    await createBorrowedLoan(accessToken, { personName: "Bob" }, "Book B");

    const res = await listLoans(accessToken, "?sort=person");

    expect(res.body.items.map((item: { personName: string }) => item.personName)).toEqual([
      "Alice",
      "Bob",
      "Carol",
    ]);
  });

  it("sorts by book title ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "Zebra Tales");
    await createBorrowedLoan(accessToken, { personName: "Ivan" }, "Apple Tales");
    await createBorrowedLoan(accessToken, { personName: "Maria" }, "Mango Tales");

    const res = await listLoans(accessToken, "?sort=title");

    expect(res.body.items.map((item: { book: { title: string } }) => item.book.title)).toEqual([
      "Apple Tales",
      "Mango Tales",
      "Zebra Tales",
    ]);
  });

  it("sorts by first author name ascending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Zed Author" }], ownershipStatus: "none", title: "One" },
      "Olha",
    );
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Ann Author" }], ownershipStatus: "none", title: "Two" },
      "Ivan",
    );
    await borrowCustomBook(
      accessToken,
      { authors: [{ name: "Mel Author" }], ownershipStatus: "none", title: "Three" },
      "Maria",
    );

    const res = await listLoans(accessToken, "?sort=author");

    expect(
      res.body.items.map(
        (item: { book: { firstAuthorName: string } }) => item.book.firstAuthorName,
      ),
    ).toEqual(["Ann Author", "Mel Author", "Zed Author"]);
  });

  it("sorts by loan date descending", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-10), personName: "Olha" }, "Old");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-1), personName: "Ivan" }, "Recent");
    await createBorrowedLoan(accessToken, { loanDate: isoDay(-5), personName: "Maria" }, "Middle");

    const res = await listLoans(accessToken, "?sort=loan_date");

    expect(res.body.items.map((item: { loanDate: string }) => item.loanDate)).toEqual([
      isoDay(-1),
      isoDay(-5),
      isoDay(-10),
    ]);
  });

  it("orders loans without a return date last when sorting by return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "NoDate" }, "No Date");
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(5), personName: "Later" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(2), personName: "Sooner" },
      "Sooner",
    );

    const res = await listLoans(accessToken, "?sort=return_date");

    expect(
      res.body.items.map(
        (item: { expectedReturnDate: Nullable<string> }) => item.expectedReturnDate,
      ),
    ).toEqual([isoDay(2), isoDay(5), null]);
  });
});

describe("GET /api/loans pagination", () => {
  it("returns the requested page and reports the total counts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), personName: "Third" },
      "Third",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(1), personName: "First" },
      "First",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(2), personName: "Second" },
      "Second",
    );

    const res = await listLoans(accessToken, "?pageSize=1&pageNumber=2");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].expectedReturnDate).toBe(isoDay(2));
    expect(res.body.page).toBe(2);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.pagesCount).toBe(3);
    expect(res.body.totalCount).toBe(3);
  });
});

describe("GET /api/loans combined filters", () => {
  it("narrows by type, filter and search together without widening past the active type", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Olha" },
      "Borrowed Olha",
    );
    await createLentLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Olha" },
      "Lent Olha",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Ivan" },
      "Borrowed Ivan",
    );

    const res = await listLoans(
      accessToken,
      "?type=borrowed_from_someone&filter=overdue&search=olha",
    );

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].type).toBe("borrowed_from_someone");
    expect(res.body.items[0].book.title).toBe("Borrowed Olha");
  });
});

describe("GET /api/loans additional filters", () => {
  it("filters loans due within the return-soon window", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(3), personName: "Olha" },
      "Soon",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(30), personName: "Ivan" },
      "Later",
    );
    await createBorrowedLoan(
      accessToken,
      { expectedReturnDate: isoDay(-3), loanDate: isoDay(-10), personName: "Maria" },
      "Overdue",
    );

    const res = await listLoans(accessToken, "?filter=return_soon");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("Soon");
    expect(res.body.items[0].loanUiStatus).toBe("return_soon");
  });

  it("filters loans that have no reminder", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createLentLoan(accessToken, {
      expectedReturnDate: isoDay(10),
      personName: "Ivan",
      remindToReturn: true,
    });
    await createBorrowedLoan(accessToken, { personName: "Olha" }, "No Reminder");

    const res = await listLoans(accessToken, "?filter=without_reminder");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.title).toBe("No Reminder");
    expect(res.body.items[0].remindToReturn).toBe(false);
  });
});

describe("GET /api/loans search", () => {
  it("searches by contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { contact: "olha@example.com", personName: "Olha" }, "A");
    await createBorrowedLoan(accessToken, { contact: "ivan@other.net", personName: "Ivan" }, "B");

    const res = await listLoans(accessToken, "?search=example.com");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha");
  });

  it("searches by note", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { note: "hardcover copy", personName: "Olha" }, "A");
    await createBorrowedLoan(accessToken, { note: "paperback edition", personName: "Ivan" }, "B");

    const res = await listLoans(accessToken, "?search=hardcover");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha");
  });

  it("searches by original title", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Antoine de Saint-Exupery" }],
        originalTitle: "Le Petit Prince",
        ownershipStatus: "none",
        title: "The Little Prince",
      },
      "Olha",
    );
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Other Author" }],
        originalTitle: "Something Else",
        ownershipStatus: "none",
        title: "Another Book",
      },
      "Ivan",
    );

    const res = await listLoans(accessToken, "?search=petit");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].book.originalTitle).toBe("Le Petit Prince");
  });

  it("matches the search term case-insensitively", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha Melnyk" });

    const res = await listLoans(accessToken, "?search=MELNYK");

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].personName).toBe("Olha Melnyk");
  });
});

describe("GET /api/loans ui status", () => {
  it("reports on_time when the return date is more than a week away", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { expectedReturnDate: isoDay(30), personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.body.items[0].loanUiStatus).toBe("on_time");
  });
});

describe("GET /api/loans book preview", () => {
  it("returns null cover, publisher and original title when the book has none", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.body.items[0].book).toMatchObject({
      cover: null,
      originalTitle: null,
      publisher: null,
    });
  });

  it("returns the publisher and original title when the book has them", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await borrowCustomBook(
      accessToken,
      {
        authors: [{ name: "Frank Herbert" }],
        originalTitle: "Original Title",
        ownershipStatus: "none",
        publisherName: "Vintage",
        title: "Dune",
      },
      "Olha",
    );

    const res = await listLoans(accessToken);

    const preview = res.body.items[0].book;
    expect(preview.originalTitle).toBe("Original Title");
    expect(preview.publisher.name).toBe("Vintage");
    expect(preview.publisher.id).toMatch(UUID);
  });
});

describe("GET /api/loans validation", () => {
  it("returns 400 for an invalid sort value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?sort=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid filter value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?filter=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid type value", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?type=bogus");

    expect(res.status).toBe(400);
  });

  it("returns 400 when the page size exceeds the maximum", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await listLoans(accessToken, "?pageSize=101");

    expect(res.status).toBe(400);
  });

  it("applies default pagination when no query params are provided", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await createBorrowedLoan(accessToken, { personName: "Olha" });

    const res = await listLoans(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(res.body.pagesCount).toBe(1);
    expect(res.body.totalCount).toBe(1);
  });
});

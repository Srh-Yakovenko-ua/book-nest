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
  await startLoan(accessToken, created.body.id, { direction: "borrowed", ...loan });
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
  await startLoan(accessToken, created.body.id, { direction: "lent", ...loan });
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
});

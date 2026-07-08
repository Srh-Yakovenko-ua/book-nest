import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { BooksModule } from "../books.module.js";

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const TODAY = new Date().toISOString().slice(0, 10);
const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule]);
  app = context.app;
  prisma = app.get(PrismaService);
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

function createLoan(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function editLoan(accessToken: string, id: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${id}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function returnLoan(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${id}/loan/return`)
    .set("Authorization", `Bearer ${accessToken}`);
}

describe("POST /api/books/:id/loan authorization", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/books/${MISSING_UUID}/loan`)
      .send({ direction: "borrowed", personName: "Olha" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed book id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createLoan(accessToken, "not-a-uuid", {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for a book that does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createLoan(accessToken, MISSING_UUID, {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });

    const res = await createLoan(stranger.accessToken, created.body.id, {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(404);
  });
});

describe("POST /api/books/:id/loan validation", () => {
  it("returns 400 when the person name is too short", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      personName: "A",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "personName" })]),
    );
  });

  it("returns 400 when a reminder is requested without an expected return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      personName: "Olha",
      remindToReturn: true,
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "expectedReturnDate",
          message: "Select a return date for the reminder",
        }),
      ]),
    );
  });

  it("returns 400 when the expected return date is before the loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      expectedReturnDate: "2026-01-01",
      loanDate: "2026-02-01",
      personName: "Olha",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "expectedReturnDate" })]),
    );
  });

  it("returns 400 when the loan date is in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      loanDate: FUTURE_DATE,
      personName: "Olha",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanDate" })]),
    );
  });
});

describe("POST /api/books/:id/loan preconditions", () => {
  it("returns 409 when borrowing a book that is not in the none state", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(409);
  });

  it("returns 409 when lending a book that is not owned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "lent",
      personName: "Olha",
    });

    expect(res.status).toBe(409);
  });
});

describe("POST /api/books/:id/loan side effects", () => {
  it("borrows a book with no ownership and defaults the loan date to today", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("borrowed_from_someone");
    expect(res.body.loanInfo).toMatchObject({ loanDate: TODAY, personName: "Olha" });
  });

  it("fills the omitted loan fields with defaults so no stale data can linger", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      direction: "borrowed",
      personName: "Olha",
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({
      contact: null,
      expectedReturnDate: null,
      note: null,
      personName: "Olha",
      remindToReturn: false,
    });
  });

  it("lends an owned book and records every provided loan field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await createLoan(accessToken, created.body.id, {
      contact: "olha@example.com",
      direction: "lent",
      expectedReturnDate: "2026-03-01",
      loanDate: "2026-01-20",
      note: "hardcover copy",
      personName: "Olha",
      remindToReturn: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("lent_to_someone");
    expect(res.body.loanInfo).toEqual({
      contact: "olha@example.com",
      expectedReturnDate: "2026-03-01",
      loanDate: "2026-01-20",
      note: "hardcover copy",
      personName: "Olha",
      remindToReturn: true,
    });
  });

  it("does not carry stale fields from a previous loan into a new one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });
    await createLoan(accessToken, created.body.id, {
      contact: "olha@example.com",
      direction: "lent",
      note: "first loan",
      personName: "Olha",
    });
    await returnLoan(accessToken, created.body.id);

    const res = await createLoan(accessToken, created.body.id, {
      direction: "lent",
      personName: "Max",
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({
      contact: null,
      note: null,
      personName: "Max",
    });
  });
});

describe("POST /api/books/:id/loan/return", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer()).post(`/api/books/${MISSING_UUID}/loan/return`);

    expect(res.status).toBe(401);
  });

  it("returns a borrowed book to the none state and marks the loan returned", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await returnLoan(accessToken, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("none");
    expect(res.body.loanInfo).toBeNull();
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("returned");
    expect(rows[0]?.returnedAt).not.toBeNull();
  });

  it("returns a lent book to the owned state and clears the loan row", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "lent_to_someone",
      title: "Dune",
    });

    const res = await returnLoan(accessToken, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body.ownershipStatus).toBe("owned");
    expect(res.body.loanInfo).toBeNull();
  });

  it("returns 409 when the book is neither borrowed nor lent", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await returnLoan(accessToken, created.body.id);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Book must be borrowed or lent to be returned");
  });

  it("leaves reading status and favorite untouched when returning a loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      isFavorite: true,
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      readingStatus: "reading",
      title: "Dune",
    });

    const res = await returnLoan(accessToken, created.body.id);

    expect(res.status).toBe(200);
    expect(res.body.readingStatus).toBe("reading");
    expect(res.body.isFavorite).toBe(true);
  });
});

describe("PATCH /api/books/:id/loan", () => {
  it("returns 401 without an Authorization header", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/books/${MISSING_UUID}/loan`)
      .send({ personName: "Olha" });

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed book id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await editLoan(accessToken, "not-a-uuid", { personName: "Olha" });

    expect(res.status).toBe(400);
  });

  it("returns 404 when the book does not exist", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await editLoan(accessToken, MISSING_UUID, { personName: "Olha" });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the book has no active loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "owned",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, { personName: "Olha" });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Loan not found");
  });

  it("returns 404 when the book belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const created = await createBook(owner.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });
    const intruder = await context.registerVerifyAndLogin();

    const res = await editLoan(intruder.accessToken, created.body.id, { personName: "Ivan" });

    expect(res.status).toBe(404);
  });

  it("updates the active loan fields and keeps the loan active", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanDate: TODAY, personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, {
      contact: "olha@example.com",
      expectedReturnDate: TODAY,
      note: "hardcover copy",
      personName: "Olha K.",
      remindToReturn: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({
      contact: "olha@example.com",
      expectedReturnDate: TODAY,
      note: "hardcover copy",
      personName: "Olha K.",
      remindToReturn: true,
    });
    const rows = await prisma.bookLoan.findMany({ where: { bookId: created.body.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");
    expect(rows[0]?.type).toBe("borrowed_from_someone");
    expect(rows[0]?.personName).toBe("Olha K.");
  });

  it("preserves the loan date when it is omitted from the payload", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanDate: TODAY, personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, { personName: "Olha K." });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo.loanDate).toBe(TODAY);
  });

  it("returns 400 when the person name is missing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, { note: "no name" });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the return date is before the loan date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, {
      expectedReturnDate: "2020-01-01",
      loanDate: TODAY,
      personName: "Olha",
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when a reminder is requested without a return date", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, {
      personName: "Olha",
      remindToReturn: true,
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when the loan date is in the future", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const created = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { personName: "Olha" },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    const res = await editLoan(accessToken, created.body.id, {
      loanDate: FUTURE_DATE,
      personName: "Olha",
    });

    expect(res.status).toBe(400);
  });
});

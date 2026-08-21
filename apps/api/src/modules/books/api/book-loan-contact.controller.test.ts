import type { LoanContactView, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { LoanContactsViewSchema } from "@app/shared";
import { formatInTimeZone } from "date-fns-tz";
import request, { type Response } from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { LoansModule } from "../../loans/index.js";
import { BooksModule } from "../books.module.js";

type StoredLoanColumns = { contact: Nullable<string>; personName: string };

const STRANGER = { email: "stranger@example.com", nickname: "stranger" } as const;

const today = (): string => formatInTimeZone(new Date(), "UTC", "yyyy-MM-dd");

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, LoansModule]);
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

async function archiveContact(contactId: string): Promise<void> {
  await prisma.loanContact.update({
    data: { archivedAt: new Date() },
    where: { id: contactId },
  });
}

function contactItems(res: Response): LoanContactView[] {
  return LoanContactsViewSchema.parse(res.body).items;
}

function contactNames(res: Response): string[] {
  return contactItems(res).map((item) => item.name);
}

function createBookRequest(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createContact(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/loans/contacts")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createLoan(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ direction: "lent", loanDate: today(), ...body });
}

function editLoan(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .patch(`/api/books/${bookId}/loan`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function getBook(accessToken: string, bookId: string): request.Test {
  return request(app.getHttpServer())
    .get(`/api/books/${bookId}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function listContacts(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/loans/contacts")
    .set("Authorization", `Bearer ${accessToken}`);
}

async function ownedBook(accessToken: string, title = "Dune"): Promise<string> {
  const res = await createBookRequest(accessToken, {
    authors: [{ name: "Frank Herbert" }],
    ownershipStatus: "owned",
    title,
  });
  expect(res.status).toBe(201);
  const bookId: string = res.body.id;
  return bookId;
}

async function savedContact(accessToken: string, body: Record<string, unknown>): Promise<string> {
  const res = await createContact(accessToken, body);
  expect(res.status).toBe(201);
  const contactId: string = res.body.id;
  return contactId;
}

function storedLoan(bookId: string): Promise<StoredLoanColumns> {
  return prisma.bookLoan.findFirstOrThrow({
    select: { contact: true, personName: true },
    where: { bookId, status: "active" },
  });
}

async function updateContact(
  accessToken: string,
  contactId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await request(app.getHttpServer())
    .patch(`/api/loans/contacts/${contactId}`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
  expect(res.status).toBe(200);
}

describe("POST /api/books/:id/loan person identity", () => {
  it("takes the name and the contact detail from the contact chosen by id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, { loanContactId: contactId });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({ contact: "ihor@example.com", personName: "Ігор" });
  });

  it("reuses the existing contact when the typed name only differs by case", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);

    const started = await createLoan(accessToken, bookId, { personName: "ІГОР" });

    expect(started.status).toBe(200);
    expect(contactItems(await listContacts(accessToken))).toEqual([
      expect.objectContaining({ loanCount: 1, name: "Ігор" }),
    ]);
  });

  it("stores the contact's own spelling of the name rather than the typed one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, { personName: "ІГОР" });

    expect(res.body.loanInfo.personName).toBe("Ігор");
  });

  it("creates a contact for a person the user has never lent to", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await ownedBook(accessToken);

    const started = await createLoan(accessToken, bookId, { personName: "Оксана" });

    expect(started.status).toBe(200);
    expect(contactItems(await listContacts(accessToken))).toEqual([
      expect.objectContaining({ loanCount: 1, name: "Оксана" }),
    ]);
  });

  it("ignores the typed name when the request also carries a contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, {
      loanContactId: contactId,
      personName: "Тарас",
    });

    expect(res.body.loanInfo.personName).toBe("Ігор");
  });

  it("creates no contact for the typed name when the request carries a contact id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);

    await createLoan(accessToken, bookId, { loanContactId: contactId, personName: "Тарас" });

    expect(contactNames(await listContacts(accessToken))).toEqual(["Ігор"]);
  });

  it("returns 400 when neither a contact id nor a name identifies the person", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, {});

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "personName" })]),
    );
  });
});

describe("POST /api/books/:id/loan contact ownership", () => {
  it("returns 404 for a contact that belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await savedContact(owner.accessToken, { name: "Ігор" });
    const stranger = await context.registerVerifyAndLogin(STRANGER);
    const bookId = await ownedBook(stranger.accessToken);

    const res = await createLoan(stranger.accessToken, bookId, {
      loanContactId: ownerContactId,
    });

    expect(res.status).toBe(404);
  });

  it("leaves the book unlent when the chosen contact belongs to another user", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await savedContact(owner.accessToken, { name: "Ігор" });
    const stranger = await context.registerVerifyAndLogin(STRANGER);
    const bookId = await ownedBook(stranger.accessToken);

    await createLoan(stranger.accessToken, bookId, { loanContactId: ownerContactId });

    const res = await getBook(stranger.accessToken, bookId);
    expect(res.body).toMatchObject({ loanInfo: null, ownershipStatus: "owned" });
  });

  it("adds no contact to the other user's list when their contact is rejected", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await savedContact(owner.accessToken, { name: "Ігор" });
    const stranger = await context.registerVerifyAndLogin(STRANGER);
    const bookId = await ownedBook(stranger.accessToken);

    await createLoan(stranger.accessToken, bookId, { loanContactId: ownerContactId });

    expect(contactNames(await listContacts(stranger.accessToken))).toEqual([]);
  });
});

describe("POST /api/books/:id/loan archived contacts", () => {
  it("returns 409 when a new loan points at an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    await archiveContact(contactId);
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, { loanContactId: contactId });

    expect(res.status).toBe(409);
  });

  it("leaves the book unlent when the chosen contact is archived", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    await archiveContact(contactId);
    const bookId = await ownedBook(accessToken);

    await createLoan(accessToken, bookId, { loanContactId: contactId });

    const res = await getBook(accessToken, bookId);
    expect(res.body).toMatchObject({ loanInfo: null, ownershipStatus: "owned" });
  });

  it("returns 409 when the typed name resolves to an archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await archiveContact(await savedContact(accessToken, { name: "Ігор" }));
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, { personName: "Ігор" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/books/:id/loan contact resolution", () => {
  it("moves the loan to another contact chosen by id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { personName: "Ігор" });
    const nextContactId = await savedContact(accessToken, { name: "Тарас" });

    const res = await editLoan(accessToken, bookId, { loanContactId: nextContactId });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo.personName).toBe("Тарас");
  });

  it("keeps a loan on the contact that was archived after the loan started", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });
    await archiveContact(contactId);

    const res = await editLoan(accessToken, bookId, {
      loanContactId: contactId,
      note: "still with him",
    });

    expect(res.status).toBe(200);
    expect(res.body.loanInfo).toMatchObject({ note: "still with him", personName: "Ігор" });
  });

  it("returns 409 when an edit moves the loan onto a different archived contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { personName: "Ігор" });
    const archivedContactId = await savedContact(accessToken, { name: "Тарас" });
    await archiveContact(archivedContactId);

    const res = await editLoan(accessToken, bookId, { loanContactId: archivedContactId });

    expect(res.status).toBe(409);
  });

  it("returns 404 when an edit points at another user's contact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await savedContact(owner.accessToken, { name: "Ігор" });
    const stranger = await context.registerVerifyAndLogin(STRANGER);
    const bookId = await ownedBook(stranger.accessToken);
    await createLoan(stranger.accessToken, bookId, { personName: "Оксана" });

    const res = await editLoan(stranger.accessToken, bookId, { loanContactId: ownerContactId });

    expect(res.status).toBe(404);
  });
});

describe("loan snapshots", () => {
  it("shows the current name of the contact on the book after a rename", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });

    await updateContact(accessToken, contactId, { name: "Ігор Петренко" });

    const res = await getBook(accessToken, bookId);
    expect(res.body.loanInfo.personName).toBe("Ігор Петренко");
  });

  it("keeps the name the loan stored when it started after the contact is renamed", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });

    await updateContact(accessToken, contactId, { name: "Ігор Петренко" });

    expect(await storedLoan(bookId)).toMatchObject({ personName: "Ігор" });
  });

  it("keeps the stored name when an edit only touches an unrelated field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });
    await updateContact(accessToken, contactId, { name: "Ігор Петренко" });

    await editLoan(accessToken, bookId, { loanContactId: contactId, note: "still with him" });

    expect(await storedLoan(bookId)).toMatchObject({ personName: "Ігор" });
  });

  it("stores the name of the new contact when an edit moves the loan", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { personName: "Ігор" });
    const nextContactId = await savedContact(accessToken, { name: "Тарас" });

    await editLoan(accessToken, bookId, { loanContactId: nextContactId });

    expect(await storedLoan(bookId)).toMatchObject({ personName: "Тарас" });
  });

  it("copies the contact detail of the person into the snapshot when the loan starts", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);

    await createLoan(accessToken, bookId, { loanContactId: contactId });

    expect(await storedLoan(bookId)).toMatchObject({ contact: "ihor@example.com" });
  });

  it("keeps the stored contact detail after the person changes theirs", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });

    await updateContact(accessToken, contactId, { contact: "+380001112233" });

    expect(await storedLoan(bookId)).toMatchObject({ contact: "ihor@example.com" });
  });

  it("shows the current detail of the contact on the book after it changes", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });

    await updateContact(accessToken, contactId, { contact: "+380001112233" });

    const res = await getBook(accessToken, bookId);
    expect(res.body.loanInfo.contact).toBe("+380001112233");
  });

  it("retakes the contact snapshot when an edit moves the loan to another contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });
    const nextContactId = await savedContact(accessToken, {
      contact: "taras@example.com",
      name: "Тарас",
    });

    await editLoan(accessToken, bookId, { loanContactId: nextContactId });

    expect(await storedLoan(bookId)).toMatchObject({ contact: "taras@example.com" });
  });

  it("keeps the stored contact detail when an edit only touches an unrelated field", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);
    await createLoan(accessToken, bookId, { loanContactId: contactId });
    await updateContact(accessToken, contactId, { contact: "+380001112233" });

    await editLoan(accessToken, bookId, { loanContactId: contactId, note: "still with him" });

    expect(await storedLoan(bookId)).toMatchObject({ contact: "ihor@example.com" });
  });

  it("ignores a contact detail the loan request tries to carry", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);

    const res = await createLoan(accessToken, bookId, {
      contact: "+380001112233",
      loanContactId: contactId,
    });

    expect(res.body.loanInfo.contact).toBe("ihor@example.com");
  });

  it("leaves the contact's own detail alone when a loan request carries one", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, {
      contact: "ihor@example.com",
      name: "Ігор",
    });
    const bookId = await ownedBook(accessToken);

    await createLoan(accessToken, bookId, {
      contact: "+380001112233",
      loanContactId: contactId,
    });

    expect(contactItems(await listContacts(accessToken))).toEqual([
      expect.objectContaining({ contact: "ihor@example.com" }),
    ]);
  });
});

describe("one contact per person name", () => {
  it("puts two loans typed with the same new name on one contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBookId = await ownedBook(accessToken, "Dune");
    const secondBookId = await ownedBook(accessToken, "Hyperion");

    await createLoan(accessToken, firstBookId, { personName: "Оксана" });
    await createLoan(accessToken, secondBookId, { personName: "Оксана" });

    expect(contactItems(await listContacts(accessToken))).toEqual([
      expect.objectContaining({ loanCount: 2, name: "Оксана" }),
    ]);
  });

  it("puts two concurrent loans typed with the same new name on one contact", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBookId = await ownedBook(accessToken, "Dune");
    const secondBookId = await ownedBook(accessToken, "Hyperion");

    const [first, second] = await Promise.all([
      createLoan(accessToken, firstBookId, { personName: "Оксана" }),
      createLoan(accessToken, secondBookId, { personName: "Оксана" }),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    expect(contactItems(await listContacts(accessToken))).toEqual([
      expect.objectContaining({ loanCount: 2, name: "Оксана" }),
    ]);
  });
});

describe("POST /api/books with a loan block", () => {
  it("returns 400 when a loan-implying ownership status carries no person identity", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBookRequest(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(400);
    expect(res.body.errorsMessages).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "loanInfo.personName" })]),
    );
  });

  it("creates the book when an empty loan block sits under a non-loan ownership status", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await createBookRequest(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: {},
      ownershipStatus: "owned",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.loanInfo).toBeNull();
  });

  it("attaches a new book's loan to the contact chosen by id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const contactId = await savedContact(accessToken, { name: "Ігор" });

    const res = await createBookRequest(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanContactId: contactId, loanDate: today() },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(201);
    expect(res.body.loanInfo).toMatchObject({ loanDate: today(), personName: "Ігор" });
  });

  it("returns 404 when a new book's loan points at another user's contact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const ownerContactId = await savedContact(owner.accessToken, { name: "Ігор" });
    const stranger = await context.registerVerifyAndLogin(STRANGER);

    const res = await createBookRequest(stranger.accessToken, {
      authors: [{ name: "Frank Herbert" }],
      loanInfo: { loanContactId: ownerContactId },
      ownershipStatus: "borrowed_from_someone",
      title: "Dune",
    });

    expect(res.status).toBe(404);
  });
});

import type { LoansQuickCounts, LoanType, Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { addDays } from "date-fns";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { startOfUtcDay, toIsoDate } from "../../../core/iso-date.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { LoansModule } from "../loans.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, LoansModule]);
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

type ContactName = "Ivan" | "Olha";

type LoanState = "active" | "returned" | "trashed";

type QuickFilterKey = keyof LoansQuickCounts;

type SeededLoans = {
  accessToken: string;
  contactIds: Record<ContactName, string>;
};

type SeedLoanInput = {
  dueInDays: Nullable<number>;
  loanedDaysAgo: number;
  note?: string;
  person: ContactName;
  remindToReturn?: boolean;
  state?: LoanState;
  title: string;
  type: LoanType;
};

const LENT = "lent_to_someone";
const BORROWED = "borrowed_from_someone";

const QUICK_FILTER_KEYS: QuickFilterKey[] = ["all", "overdue", "return_soon", "no_return_date"];

const ZERO_COUNTS: LoansQuickCounts = { all: 0, no_return_date: 0, overdue: 0, return_soon: 0 };

const TotalCountSchema = z.object({ totalCount: z.number() });

const QuickCountsResponseSchema = z
  .object({
    all: z.number(),
    no_return_date: z.number(),
    overdue: z.number(),
    return_soon: z.number(),
  })
  .strict();

const SEED_LOANS: SeedLoanInput[] = [
  {
    dueInDays: -3,
    loanedDaysAgo: 40,
    note: "signed",
    person: "Ivan",
    remindToReturn: true,
    title: "Hyperion",
    type: LENT,
  },
  { dueInDays: 0, loanedDaysAgo: 10, note: "signed", person: "Olha", title: "Dune", type: LENT },
  { dueInDays: 30, loanedDaysAgo: 10, person: "Ivan", title: "Dune Messiah", type: LENT },
  { dueInDays: null, loanedDaysAgo: 40, person: "Olha", title: "Solaris", type: LENT },
  {
    dueInDays: null,
    loanedDaysAgo: 10,
    note: "fragile",
    person: "Ivan",
    title: "Dune Chronicles",
    type: LENT,
  },
  {
    dueInDays: -5,
    loanedDaysAgo: 40,
    person: "Ivan",
    state: "returned",
    title: "Returned Tale",
    type: LENT,
  },
  {
    dueInDays: -2,
    loanedDaysAgo: 10,
    person: "Olha",
    state: "trashed",
    title: "Dune Trashed",
    type: LENT,
  },
  { dueInDays: -1, loanedDaysAgo: 10, person: "Olha", title: "Dune Guide", type: BORROWED },
  { dueInDays: 7, loanedDaysAgo: 40, person: "Ivan", title: "Neuromancer", type: BORROWED },
  {
    dueInDays: null,
    loanedDaysAgo: 10,
    note: "library copy",
    person: "Olha",
    title: "Foundation",
    type: BORROWED,
  },
];

function dayFromToday(offsetDays: number): Date {
  return addDays(startOfUtcDay(new Date()), offsetDays);
}

function getQuickCounts(accessToken: string, query = ""): request.Test {
  const path = query === "" ? "/api/loans/quick-counts" : `/api/loans/quick-counts?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function listTotalCount({
  accessToken,
  params,
}: {
  accessToken: string;
  params: [string, string][];
}): Promise<number> {
  const query = new URLSearchParams([...params, ["pageSize", "1"]]).toString();
  const res = await request(app.getHttpServer())
    .get(`/api/loans?${query}`)
    .set("Authorization", `Bearer ${accessToken}`);
  expect(res.status).toBe(200);
  return TotalCountSchema.parse(res.body).totalCount;
}

async function quickCountsOf(accessToken: string, query = ""): Promise<LoansQuickCounts> {
  const res = await getQuickCounts(accessToken, query);
  expect(res.status).toBe(200);
  return QuickCountsResponseSchema.parse(res.body);
}

async function seedLoan({
  contactId,
  loan,
  userId,
}: {
  contactId: string;
  loan: SeedLoanInput;
  userId: string;
}): Promise<void> {
  const state = loan.state ?? "active";
  const book = await prisma.book.create({
    data: {
      ownershipStatus: loan.type,
      title: loan.title,
      userId,
      ...(state === "trashed" ? TRASH_RETENTION.stamp(new Date()) : {}),
    },
    select: { id: true },
  });
  await prisma.bookLoan.create({
    data: {
      bookId: book.id,
      expectedReturnDate: loan.dueInDays === null ? null : dayFromToday(loan.dueInDays),
      loanContactId: contactId,
      loanDate: dayFromToday(-loan.loanedDaysAgo),
      note: loan.note ?? null,
      personName: loan.person,
      remindToReturn: loan.remindToReturn ?? false,
      returnedAt: state === "returned" ? new Date() : null,
      status: state === "returned" ? "returned" : "active",
      type: loan.type,
      userId,
    },
  });
}

async function seedLoans(): Promise<SeededLoans> {
  const { accessToken, userId } = await context.registerVerifyAndLogin();
  const ivan = await prisma.loanContact.create({
    data: { name: "Ivan", normalizedName: "ivan", userId },
    select: { id: true },
  });
  const olha = await prisma.loanContact.create({
    data: { name: "Olha", normalizedName: "olha", userId },
    select: { id: true },
  });
  const contactIds: Record<ContactName, string> = { Ivan: ivan.id, Olha: olha.id };
  for (const loan of SEED_LOANS) {
    await seedLoan({ contactId: contactIds[loan.person], loan, userId });
  }
  return { accessToken, contactIds };
}

describe("GET /api/loans/quick-counts", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/loans/quick-counts");

    expect(res.status).toBe(401);
  });

  it("returns 400 for an inverted loan date range", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getQuickCounts(accessToken, "loanDateFrom=2026-09-10&loanDateTo=2026-09-01");

    expect(res.status).toBe(400);
  });

  it("returns zero for every chip when the user has no loans", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    expect(await quickCountsOf(accessToken, `type=${LENT}`)).toEqual(ZERO_COUNTS);
  });

  it("counts every chip of the lent direction without a query", async () => {
    const { accessToken } = await seedLoans();

    expect(await quickCountsOf(accessToken, `type=${LENT}`)).toEqual({
      all: 5,
      no_return_date: 2,
      overdue: 1,
      return_soon: 1,
    });
  });

  it("keeps the borrowed direction apart from the lent one", async () => {
    const { accessToken } = await seedLoans();

    expect(await quickCountsOf(accessToken, `type=${BORROWED}`)).toEqual({
      all: 3,
      no_return_date: 1,
      overdue: 1,
      return_soon: 1,
    });
  });

  it("counts both directions together when no direction is given, like the list", async () => {
    const { accessToken } = await seedLoans();

    expect(await quickCountsOf(accessToken)).toEqual({
      all: 8,
      no_return_date: 3,
      overdue: 2,
      return_soon: 2,
    });
  });

  it("follows the search", async () => {
    const { accessToken } = await seedLoans();

    expect(await quickCountsOf(accessToken, `type=${LENT}&search=Dune`)).toEqual({
      all: 3,
      no_return_date: 1,
      overdue: 0,
      return_soon: 1,
    });
  });

  it("follows the contact filter and returns zero for a chip with no match", async () => {
    const { accessToken, contactIds } = await seedLoans();

    expect(await quickCountsOf(accessToken, `type=${LENT}&contactId=${contactIds.Ivan}`)).toEqual({
      all: 3,
      no_return_date: 1,
      overdue: 1,
      return_soon: 0,
    });
    expect(await quickCountsOf(accessToken, `type=${LENT}&contactId=${contactIds.Olha}`)).toEqual({
      all: 2,
      no_return_date: 1,
      overdue: 0,
      return_soon: 1,
    });
  });

  it("follows the note filter combined with the search", async () => {
    const { accessToken } = await seedLoans();

    expect(await quickCountsOf(accessToken, `type=${LENT}&hasNote=true`)).toEqual({
      all: 3,
      no_return_date: 1,
      overdue: 1,
      return_soon: 1,
    });
    expect(await quickCountsOf(accessToken, `type=${LENT}&hasNote=true&search=Dune`)).toEqual({
      all: 2,
      no_return_date: 1,
      overdue: 0,
      return_soon: 1,
    });
  });

  it("ignores the quick filter, sort and paging the request carries", async () => {
    const { accessToken } = await seedLoans();

    const plain = await quickCountsOf(accessToken, `type=${LENT}&search=Dune`);
    const withQuickAxis = await quickCountsOf(
      accessToken,
      `type=${LENT}&search=Dune&filter=overdue&sort=title&pageNumber=2&pageSize=1`,
    );

    expect(withQuickAxis).toEqual(plain);
  });

  it("does not count returned loans or loans of trashed books", async () => {
    const { accessToken } = await seedLoans();
    const storedLentLoans = await prisma.bookLoan.count({ where: { type: LENT } });

    const counts = await quickCountsOf(accessToken, `type=${LENT}`);

    expect(storedLentLoans).toBe(7);
    expect(counts.all).toBe(5);
    expect(counts.overdue).toBe(1);
  });

  it("never counts the loans of another user", async () => {
    await seedLoans();
    const { accessToken } = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
    });

    expect(await quickCountsOf(accessToken, `type=${LENT}`)).toEqual(ZERO_COUNTS);
    expect(await quickCountsOf(accessToken, `type=${BORROWED}`)).toEqual(ZERO_COUNTS);
  });

  const DIRECTION_CASES: { direction: [string, string][]; label: string }[] = [
    { direction: [["type", LENT]], label: "lent" },
    { direction: [["type", BORROWED]], label: "borrowed" },
    { direction: [], label: "both directions" },
  ];

  it.each(DIRECTION_CASES)(
    "matches the list total for every chip of $label under each query",
    async ({ direction }) => {
      const { accessToken, contactIds } = await seedLoans();
      const paramSets: [string, string][][] = [
        [],
        [["search", "Dune"]],
        [["contactId", contactIds.Ivan]],
        [["hasNote", "true"]],
        [["reminder", "off"]],
        [["loanDateFrom", toIsoDate(dayFromToday(-20))]],
        [
          ["search", "Dune"],
          ["contactId", contactIds.Olha],
        ],
      ];

      for (const params of paramSets) {
        const query = [...direction, ...params];
        const counts = await quickCountsOf(accessToken, new URLSearchParams(query).toString());

        for (const chip of QUICK_FILTER_KEYS) {
          const totalCount = await listTotalCount({
            accessToken,
            params: [...query, ["filter", chip]],
          });
          expect({ chip, count: counts[chip], query }).toEqual({
            chip,
            count: totalCount,
            query,
          });
        }
      }
    },
  );
});

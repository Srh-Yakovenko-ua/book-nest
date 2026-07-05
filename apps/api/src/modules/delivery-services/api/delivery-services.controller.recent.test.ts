import type { DeliveryServiceView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { normalizeName } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryServicesModule } from "../delivery-services.module.js";

const DELIVERY_SERVICE_VIEW_KEYS = ["countryCode", "id", "isCustom", "name"];

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([
    AuthModule,
    DeliveryServicesModule,
    BooksModule,
    ListsModule,
  ]);
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

function createBook(accessToken: string, title: string): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ authors: [{ name: "Frank Herbert" }], title });
}

function createDelivery(input: {
  accessToken: string;
  bookId: string;
  deliveryService: string;
}): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${input.bookId}/deliveries`)
    .set("Authorization", `Bearer ${input.accessToken}`)
    .send({
      deliveryService: input.deliveryService,
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });
}

function getRecent(accessToken: string, query?: string): request.Test {
  const path =
    query === undefined
      ? "/api/delivery-services/recent"
      : `/api/delivery-services/recent?${query}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

function recentNames(body: DeliveryServiceView[]): string[] {
  return body.map((view) => view.name);
}

function seedGlobalDeliveryService(input: {
  countryCode?: null | string;
  name: string;
  sortOrder: number;
}): Promise<{ id: string }> {
  return prisma.deliveryService.create({
    data: {
      countryCode: input.countryCode ?? null,
      isDefault: true,
      name: input.name,
      normalizedName: normalizeName(input.name),
      sortOrder: input.sortOrder,
      userId: null,
    },
    select: { id: true },
  });
}

async function seedRecentDelivery(input: {
  accessToken: string;
  createdAt: Date;
  deliveryService: string;
  title: string;
}): Promise<void> {
  const book = await createBook(input.accessToken, input.title);
  const delivery = await createDelivery({
    accessToken: input.accessToken,
    bookId: book.body.id,
    deliveryService: input.deliveryService,
  });
  expect(delivery.status).toBe(200);
  await stampDeliveryCreatedAt({
    createdAt: input.createdAt,
    deliveryService: input.deliveryService,
  });
}

async function stampDeliveryCreatedAt(input: {
  createdAt: Date;
  deliveryService: string;
}): Promise<void> {
  await prisma.bookDelivery.updateMany({
    data: { createdAt: input.createdAt },
    where: { deliveryService: input.deliveryService },
  });
}

describe("GET /api/delivery-services/recent", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/delivery-services/recent");

    expect(res.status).toBe(401);
  });

  it("returns 401 when the access token is invalid", async () => {
    const res = await getRecent("not-a-real-token");

    expect(res.status).toBe(401);
  });

  it("returns an empty array when the user has no deliveries", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("ranks the most recently used service first and exposes the view shape with country code", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });
    await seedGlobalDeliveryService({ countryCode: "DE", name: "DHL", sortOrder: 1 });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      deliveryService: "Нова Пошта",
      title: "Dune",
    });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      deliveryService: "DHL",
      title: "Foundation",
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentNames(res.body)).toEqual(["DHL", "Нова Пошта"]);
    for (const view of res.body) {
      expect(Object.keys(view).sort()).toEqual(DELIVERY_SERVICE_VIEW_KEYS);
    }
    expect(res.body[0]).toMatchObject({ countryCode: "DE", isCustom: false, name: "DHL" });
  });

  it("resolves a case and spacing snapshot variant to the single matching global", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });
    const book = await createBook(accessToken, "Dune");
    const delivery = await createDelivery({
      accessToken,
      bookId: book.body.id,
      deliveryService: "  нова   ПОШТА ",
    });
    expect(delivery.status).toBe(200);

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ countryCode: "UA", isCustom: false, name: "Нова Пошта" });
  });

  it("silently skips a snapshot whose custom catalog row was deleted", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      deliveryService: "Нова Пошта",
      title: "Dune",
    });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      deliveryService: "My Personal Courier",
      title: "Foundation",
    });
    await prisma.deliveryService.deleteMany({
      where: { normalizedName: normalizeName("My Personal Courier"), userId },
    });

    const res = await getRecent(accessToken);

    expect(res.status).toBe(200);
    expect(recentNames(res.body)).toEqual(["Нова Пошта"]);
  });

  it("does not surface another user's recently used services", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });
    await seedGlobalDeliveryService({ countryCode: "DE", name: "DHL", sortOrder: 1 });
    await seedRecentDelivery({
      accessToken: owner.accessToken,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      deliveryService: "Нова Пошта",
      title: "Dune",
    });
    await seedRecentDelivery({
      accessToken: stranger.accessToken,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      deliveryService: "DHL",
      title: "Foundation",
    });

    const res = await getRecent(owner.accessToken);

    expect(recentNames(res.body)).toEqual(["Нова Пошта"]);
    expect(recentNames(res.body)).not.toContain("DHL");
  });

  it("caps the result to the most recent service when limit is 1", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ countryCode: "UA", name: "Нова Пошта", sortOrder: 0 });
    await seedGlobalDeliveryService({ countryCode: "DE", name: "DHL", sortOrder: 1 });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      deliveryService: "Нова Пошта",
      title: "Dune",
    });
    await seedRecentDelivery({
      accessToken,
      createdAt: new Date("2026-02-01T10:00:00.000Z"),
      deliveryService: "DHL",
      title: "Foundation",
    });

    const res = await getRecent(accessToken, "limit=1");

    expect(res.status).toBe(200);
    expect(recentNames(res.body)).toEqual(["DHL"]);
  });

  it("rejects a limit below the allowed minimum with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=0");

    expect(res.status).toBe(400);
  });

  it("rejects a limit above the allowed maximum with 400", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await getRecent(accessToken, "limit=21");

    expect(res.status).toBe(400);
  });
});

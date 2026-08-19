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

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const DELIVERY_SERVICE_VIEW_KEYS = [
  "countryCode",
  "id",
  "isCustom",
  "name",
  "providerKey",
  "trackingUrlTemplate",
];

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

function createBook(accessToken: string, body: Record<string, unknown>): request.Test {
  return request(app.getHttpServer())
    .post("/api/books")
    .set("Authorization", `Bearer ${accessToken}`)
    .send(body);
}

function createDelivery(
  accessToken: string,
  bookId: string,
  body: Record<string, unknown>,
): request.Test {
  return request(app.getHttpServer())
    .post(`/api/books/${bookId}/deliveries`)
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ currency: "UAH", price: 350, ...body });
}

function deleteDeliveryService(accessToken: string, id: string): request.Test {
  return request(app.getHttpServer())
    .delete(`/api/delivery-services/${id}`)
    .set("Authorization", `Bearer ${accessToken}`);
}

function listDeliveryServices(accessToken: string): request.Test {
  return request(app.getHttpServer())
    .get("/api/delivery-services")
    .set("Authorization", `Bearer ${accessToken}`);
}

function seedCustomDeliveryService(input: {
  name: string;
  userId: string;
}): Promise<{ id: string; name: string }> {
  return prisma.deliveryService.create({
    data: {
      isDefault: false,
      name: input.name,
      normalizedName: normalizeName(input.name),
      sortOrder: 0,
      userId: input.userId,
    },
    select: { id: true, name: true },
  });
}

function seedGlobalDeliveryService(input: {
  name: string;
  sortOrder: number;
}): Promise<{ id: string; name: string }> {
  return prisma.deliveryService.create({
    data: {
      isDefault: true,
      name: input.name,
      normalizedName: normalizeName(input.name),
      sortOrder: input.sortOrder,
      userId: null,
    },
    select: { id: true, name: true },
  });
}

describe("GET /api/delivery-services", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/delivery-services");

    expect(res.status).toBe(401);
  });

  it("returns the global defaults and the caller's own custom services in the view shape", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    await seedCustomDeliveryService({ name: "My Courier", userId });

    const res = await listDeliveryServices(accessToken);

    expect(res.status).toBe(200);
    const names = res.body.items.map((item: { name: string }) => item.name).sort();
    expect(names).toEqual(["My Courier", "Нова Пошта"]);
    for (const item of res.body.items) {
      expect(Object.keys(item).sort()).toEqual(DELIVERY_SERVICE_VIEW_KEYS);
    }
  });

  it("marks global rows as isCustom false and own rows as isCustom true", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    await seedCustomDeliveryService({ name: "My Courier", userId });

    const res = await listDeliveryServices(accessToken);

    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isCustom: false, name: "Нова Пошта" }),
        expect.objectContaining({ isCustom: true, name: "My Courier" }),
      ]),
    );
  });

  it("does not return another user's custom services", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    await seedCustomDeliveryService({ name: "Stranger Courier", userId: stranger.userId });

    const res = await listDeliveryServices(owner.accessToken);

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Нова Пошта");
    expect(names).not.toContain("Stranger Courier");
  });

  it("filters cyrillic names case-insensitively and excludes non-matching latin names", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    await seedGlobalDeliveryService({ name: "Meest", sortOrder: 1 });
    await seedCustomDeliveryService({ name: "Nova Local", userId });

    const res = await listDeliveryServices(accessToken).query({ search: "нова" });

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(["Нова Пошта"]);
  });

  it("filters latin names case-insensitively", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Meest", sortOrder: 0 });
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 1 });

    const res = await listDeliveryServices(accessToken).query({ search: "meest" });

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(["Meest"]);
  });

  it("orders global defaults by sortOrder ahead of custom services ordered by name", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Укрпошта", sortOrder: 1 });
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    await seedCustomDeliveryService({ name: "Bravo Courier", userId });
    await seedCustomDeliveryService({ name: "Alpha Courier", userId });

    const res = await listDeliveryServices(accessToken);

    const names = res.body.items.map((item: { name: string }) => item.name);
    expect(names).toEqual(["Нова Пошта", "Укрпошта", "Alpha Courier", "Bravo Courier"]);
  });
});

describe("DELETE /api/delivery-services/:id", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).delete(`/api/delivery-services/${MISSING_UUID}`);

    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed id", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();

    const res = await deleteDeliveryService(accessToken, "not-a-uuid");

    expect(res.status).toBe(400);
  });

  it("deletes the caller's own custom service and returns 204", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    const custom = await seedCustomDeliveryService({ name: "My Courier", userId });

    const res = await deleteDeliveryService(accessToken, custom.id);

    expect(res.status).toBe(204);
    const list = await listDeliveryServices(accessToken);
    const names = list.body.items.map((item: { name: string }) => item.name);
    expect(names).not.toContain("My Courier");
  });

  it("returns 404 when deleting a global default and leaves it in place", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const globalService = await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });

    const res = await deleteDeliveryService(accessToken, globalService.id);

    expect(res.status).toBe(404);
    const list = await listDeliveryServices(accessToken);
    const names = list.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Нова Пошта");
  });

  it("returns 404 when deleting another user's custom service and leaves it intact", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    const strangerCustom = await seedCustomDeliveryService({
      name: "Stranger Courier",
      userId: stranger.userId,
    });

    const res = await deleteDeliveryService(owner.accessToken, strangerCustom.id);

    expect(res.status).toBe(404);
    const list = await listDeliveryServices(stranger.accessToken);
    const names = list.body.items.map((item: { name: string }) => item.name);
    expect(names).toContain("Stranger Courier");
  });
});

describe("delivery-service implicit upsert via book deliveries", () => {
  it("creates a custom service when a delivery uses a brand-new service name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const book = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const delivery = await createDelivery(accessToken, book.body.id, {
      deliveryService: "My Personal Courier",
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });
    expect(delivery.status).toBe(200);

    const list = await listDeliveryServices(accessToken);
    expect(list.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isCustom: true, name: "My Personal Courier" }),
      ]),
    );
  });

  it("does not create a duplicate custom when a delivery reuses a global under a different case and spacing", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedGlobalDeliveryService({ name: "Нова Пошта", sortOrder: 0 });
    const book = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });

    const delivery = await createDelivery(accessToken, book.body.id, {
      deliveryService: "  нова   ПОШТА ",
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });
    expect(delivery.status).toBe(200);

    const rows = await prisma.deliveryService.findMany({
      where: { normalizedName: "нова пошта" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBeNull();
  });

  it("reuses the same custom row when two deliveries reference one new service name", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    const firstBook = await createBook(accessToken, {
      authors: [{ name: "Frank Herbert" }],
      title: "Dune",
    });
    const secondBook = await createBook(accessToken, {
      authors: [{ name: "Isaac Asimov" }],
      title: "Foundation",
    });

    const first = await createDelivery(accessToken, firstBook.body.id, {
      deliveryService: "Neighbor Handoff",
      orderDate: "2026-01-20",
      storeName: "Yakaboo",
    });
    const second = await createDelivery(accessToken, secondBook.body.id, {
      deliveryService: "  neighbor   HANDOFF ",
      orderDate: "2026-01-21",
      storeName: "Rozetka",
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rows = await prisma.deliveryService.findMany({
      where: { normalizedName: "neighbor handoff" },
    });
    expect(rows).toHaveLength(1);
  });
});

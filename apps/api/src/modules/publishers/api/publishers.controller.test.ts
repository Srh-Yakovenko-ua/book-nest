import type { Nullable } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthTestContext } from "../../../test/auth-test-context.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { PublishersModule } from "../publishers.module.js";

let context: AuthTestContext;
let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, PublishersModule]);
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

function searchPublishers(accessToken: string, search?: string): request.Test {
  const path = search === undefined ? "/api/publishers" : `/api/publishers?search=${search}`;
  return request(app.getHttpServer()).get(path).set("Authorization", `Bearer ${accessToken}`);
}

async function seedPublisher(data: {
  countryCode?: Nullable<string>;
  foundedYear?: Nullable<number>;
  logoUrl?: Nullable<string>;
  name: string;
  names?: { isPrimary: boolean; locale: string; name: string; normalizedName: string }[];
  normalizedName: string;
  searchText?: string;
  userId?: Nullable<string>;
  websiteUrl?: Nullable<string>;
  wikidataId?: Nullable<string>;
}): Promise<void> {
  await prisma.publisher.create({
    data: {
      countryCode: data.countryCode ?? null,
      foundedYear: data.foundedYear ?? null,
      logoUrl: data.logoUrl ?? null,
      name: data.name,
      names: {
        create: data.names ?? [
          {
            isPrimary: true,
            locale: "uk",
            name: data.name,
            normalizedName: data.normalizedName,
          },
        ],
      },
      normalizedName: data.normalizedName,
      searchText: data.searchText ?? data.normalizedName,
      userId: data.userId ?? null,
      websiteUrl: data.websiteUrl ?? null,
      wikidataId: data.wikidataId ?? null,
    },
  });
}

describe("GET /api/publishers", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get("/api/publishers");

    expect(res.status).toBe(401);
  });

  it("returns a paginator with global seeds and the caller's own custom publishers", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Penguin", normalizedName: "penguin", userId: null });
    await seedPublisher({ name: "My Press", normalizedName: "my press", userId });

    const res = await searchPublishers(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(2);
    expect(res.body.page).toBe(1);
    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(expect.arrayContaining(["Penguin", "My Press"]));
  });

  it("orders the caller's own custom publishers before global seeds", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Penguin", normalizedName: "penguin", userId: null });
    await seedPublisher({ name: "My Press", normalizedName: "my press", userId });

    const res = await searchPublishers(accessToken);

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(["My Press", "Penguin"]);
  });

  it("marks own custom publishers with isCustom true and global seeds with false", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Penguin", normalizedName: "penguin", userId: null });
    await seedPublisher({ name: "My Press", normalizedName: "my press", userId });

    const res = await searchPublishers(accessToken);

    const byName = new Map(
      res.body.items.map((publisher: { isCustom: boolean; name: string }) => [
        publisher.name,
        publisher.isCustom,
      ]),
    );
    expect(byName.get("Penguin")).toBe(false);
    expect(byName.get("My Press")).toBe(true);
  });

  it("does not return another user's custom publisher", async () => {
    const owner = await context.registerVerifyAndLogin();
    const stranger = await context.registerVerifyAndLogin({
      email: "stranger@example.com",
      nickname: "stranger",
    });
    await seedPublisher({
      name: "Secret Press",
      normalizedName: "secret press",
      userId: stranger.userId,
    });

    const res = await searchPublishers(owner.accessToken);

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).not.toContain("Secret Press");
  });

  it("filters by a case-insensitive search term", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "Penguin", normalizedName: "penguin", userId: null });
    await seedPublisher({ name: "Vintage", normalizedName: "vintage", userId: null });

    const res = await searchPublishers(accessToken, "PENGUIN");

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(["Penguin"]);
  });

  it("matches a publisher by an alias in another locale", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({
      name: "Vydavnytstvo Stary Lev",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Vydavnytstvo Stary Lev",
          normalizedName: "vydavnytstvo stary lev",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Старого Лева",
          normalizedName: "видавництво старого лева",
        },
      ],
      normalizedName: "vydavnytstvo stary lev",
      searchText: "vydavnytstvo stary lev видавництво старого лева",
      userId: null,
    });

    const res = await searchPublishers(accessToken, "Stary");

    const names = res.body.items.map((publisher: { name: string }) => publisher.name);
    expect(names).toEqual(["Видавництво Старого Лева"]);
  });

  it("resolves the display name to the requested locale", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({
      name: "Vydavnytstvo Stary Lev",
      names: [
        {
          isPrimary: true,
          locale: "en",
          name: "Vydavnytstvo Stary Lev",
          normalizedName: "vydavnytstvo stary lev",
        },
        {
          isPrimary: true,
          locale: "uk",
          name: "Видавництво Старого Лева",
          normalizedName: "видавництво старого лева",
        },
      ],
      normalizedName: "vydavnytstvo stary lev",
      searchText: "vydavnytstvo stary lev видавництво старого лева",
      userId: null,
    });

    const ukrainian = await request(app.getHttpServer())
      .get("/api/publishers?locale=uk")
      .set("Authorization", `Bearer ${accessToken}`);
    const english = await request(app.getHttpServer())
      .get("/api/publishers?locale=en")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(ukrainian.body.items[0].name).toBe("Видавництво Старого Лева");
    expect(english.body.items[0].name).toBe("Vydavnytstvo Stary Lev");
  });

  it("paginates results across pages", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    for (const name of ["Press A", "Press B", "Press C"]) {
      await seedPublisher({ name, normalizedName: name.toLowerCase(), userId: null });
    }

    const firstPage = await request(app.getHttpServer())
      .get("/api/publishers?pageSize=2&pageNumber=1")
      .set("Authorization", `Bearer ${accessToken}`);
    const secondPage = await request(app.getHttpServer())
      .get("/api/publishers?pageSize=2&pageNumber=2")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(firstPage.body.totalCount).toBe(3);
    expect(firstPage.body.pagesCount).toBe(2);
    expect(firstPage.body.items).toHaveLength(2);
    expect(secondPage.body.items).toHaveLength(1);
  });
});

describe("GET /api/publishers catalog fields", () => {
  it("returns the enriched fields for a global seeded publisher", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({
      countryCode: "UA",
      foundedYear: 2001,
      logoUrl: "https://example.org/stary-lev.svg",
      name: "Vydavnytstvo Stary Lev",
      normalizedName: "vydavnytstvo stary lev",
      userId: null,
      websiteUrl: "https://starylev.com.ua",
      wikidataId: "Q12345",
    });

    const res = await searchPublishers(accessToken);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toEqual({
      countryCode: "UA",
      foundedYear: 2001,
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      isCustom: false,
      logoAttribution: null,
      logoLicense: null,
      logoLicenseUrl: null,
      logoUrl: "https://example.org/stary-lev.svg",
      name: "Vydavnytstvo Stary Lev",
      websiteUrl: "https://starylev.com.ua",
    });
  });

  it("returns null catalog fields for a custom publisher created without enrichment", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({ name: "My Press", normalizedName: "my press", userId });

    const res = await searchPublishers(accessToken);

    expect(res.body.items[0]).toEqual({
      countryCode: null,
      foundedYear: null,
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      isCustom: true,
      logoAttribution: null,
      logoLicense: null,
      logoLicenseUrl: null,
      logoUrl: null,
      name: "My Press",
      websiteUrl: null,
    });
  });

  it("does not expose the wikidata id or timestamps in the view", async () => {
    const { accessToken } = await context.registerVerifyAndLogin();
    await seedPublisher({
      name: "Vintage",
      normalizedName: "vintage",
      userId: null,
      wikidataId: "Q67890",
    });

    const res = await searchPublishers(accessToken);

    expect(res.body.items[0]).not.toHaveProperty("wikidataId");
    expect(res.body.items[0]).not.toHaveProperty("normalizedName");
    expect(res.body.items[0]).not.toHaveProperty("searchText");
    expect(res.body.items[0]).not.toHaveProperty("createdAt");
    expect(res.body.items[0]).not.toHaveProperty("userId");
  });

  it("marks a global publisher with rich fields as not custom and a user publisher as custom", async () => {
    const { accessToken, userId } = await context.registerVerifyAndLogin();
    await seedPublisher({
      countryCode: "GB",
      foundedYear: 1935,
      name: "Penguin",
      normalizedName: "penguin",
      userId: null,
    });
    await seedPublisher({
      countryCode: "UA",
      name: "My Press",
      normalizedName: "my press",
      userId,
    });

    const res = await searchPublishers(accessToken);

    const byName = new Map(
      res.body.items.map(
        (publisher: { countryCode: Nullable<string>; isCustom: boolean; name: string }) => [
          publisher.name,
          publisher,
        ],
      ),
    );
    expect(byName.get("Penguin")).toMatchObject({ countryCode: "GB", isCustom: false });
    expect(byName.get("My Press")).toMatchObject({ countryCode: "UA", isCustom: true });
  });
});

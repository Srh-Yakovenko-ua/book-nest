import type { InTransitQuickCounts, InTransitQuickFilterKey } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { InTransitQuickCountsSchema, InTransitQuickFilterKeySchema } from "@app/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  cancelBooksOfOrder,
  createBooks,
  createOrder,
  getJson,
  isoDay,
  ORDER_ROUTES,
  postJson,
  shipmentOf,
} from "./book-order.fixtures.js";

const QUICK_COUNTS_ROUTE = "/api/delivery/books/in-transit/quick-counts";

const BOOKS = {
  arrived: "Arrived",
  cancelled: "Cancelled",
  dune: "Dune",
  duneMessiah: "Dune Messiah",
  hyperion: "Hyperion",
  neuromancer: "Neuromancer",
  solaris: "Solaris",
} as const;

const ZERO_COUNTS: InTransitQuickCounts = {
  all: 0,
  delayed: 0,
  in_transit: 0,
  ordered: 0,
  ready_for_pickup: 0,
};

const SEEDED_COUNTS: InTransitQuickCounts = {
  all: 5,
  delayed: 1,
  in_transit: 1,
  ordered: 3,
  ready_for_pickup: 1,
};

const TotalCountSchema = z.object({ totalCount: z.number() });

let context: AuthTestContext;
let app: INestApplication;
let reader: AuthenticatedUser;

beforeAll(async () => {
  context = await createAuthTestContext([AuthModule, BooksModule, ListsModule, DeliveryModule]);
  app = context.app;
});

beforeEach(async () => {
  context.reset();
  reader = await context.registerVerifyAndLogin();
});

afterEach(async () => {
  await truncateAllTables(app);
});

afterAll(async () => {
  await context.close();
});

async function listTotalForChip({
  chip,
  query,
}: {
  chip: InTransitQuickFilterKey;
  query: string;
}): Promise<number> {
  const params = new URLSearchParams(query);
  params.set("filter", chip);
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.inTransit}?${params.toString()}`,
  });
  if (res.status !== 200) {
    throw new Error(`in-transit read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return TotalCountSchema.parse(res.body).totalCount;
}

async function markShipment({
  bookId,
  route,
  view,
}: {
  bookId: string;
  route: (shipmentId: string) => string;
  view: Awaited<ReturnType<typeof createOrder>>;
}): Promise<void> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    path: route(shipmentOf({ bookId, view }).id),
  });
  if (res.status !== 200) {
    throw new Error(`shipment update failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
}

async function quickCounts(
  query = "",
  accessToken = reader.accessToken,
): Promise<InTransitQuickCounts> {
  const res = await getJson({ accessToken, app, path: `${QUICK_COUNTS_ROUTE}?${query}` });
  if (res.status !== 200) {
    throw new Error(`quick counts read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return InTransitQuickCountsSchema.parse(res.body);
}

async function seedInTransitFixture(): Promise<void> {
  const [arrived, cancelled, dune, duneMessiah, hyperion, neuromancer, solaris] = await createBooks(
    {
      accessToken: reader.accessToken,
      app,
      titles: [
        BOOKS.arrived,
        BOOKS.cancelled,
        BOOKS.dune,
        BOOKS.duneMessiah,
        BOOKS.hyperion,
        BOOKS.neuromancer,
        BOOKS.solaris,
      ],
    },
  );

  const yakaboo = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [
        { bookId: dune ?? "", price: 300 },
        { bookId: duneMessiah ?? "", price: 200 },
        { bookId: arrived ?? "", price: 100 },
      ],
      shipments: [
        { bookIds: [dune ?? ""], expectedDeliveryDate: isoDay(-3) },
        { bookIds: [arrived ?? ""], expectedDeliveryDate: isoDay(-2) },
      ],
      storeName: "Yakaboo",
    },
  });
  await markShipment({
    bookId: arrived ?? "",
    route: ORDER_ROUTES.receiveShipment,
    view: yakaboo,
  });

  const book24 = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [{ bookId: solaris ?? "", price: 900 }],
      shipments: [{ bookIds: [solaris ?? ""], expectedDeliveryDate: isoDay(5) }],
      storeName: "Book24",
    },
  });
  await markShipment({ bookId: solaris ?? "", route: ORDER_ROUTES.markInTransit, view: book24 });

  const amazon = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "EUR",
      items: [{ bookId: neuromancer ?? "", price: 40 }],
      shipments: [{ bookIds: [neuromancer ?? ""], expectedDeliveryDate: isoDay(1) }],
      storeName: "Amazon",
    },
  });
  await markShipment({
    bookId: neuromancer ?? "",
    route: ORDER_ROUTES.markReadyForPickup,
    view: amazon,
  });

  const bookva = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      currency: "UAH",
      items: [
        { bookId: hyperion ?? "", price: 250 },
        { bookId: cancelled ?? "", price: 150 },
      ],
      storeName: "Bookva",
    },
  });
  await cancelBooksOfOrder({
    accessToken: reader.accessToken,
    app,
    bookIds: [cancelled ?? ""],
    view: bookva,
  });
}

describe("GET /api/delivery/books/in-transit/quick-counts", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app.getHttpServer()).get(QUICK_COUNTS_ROUTE);

    expect(res.status).toBe(401);
  });

  it("returns 400 for an invalid advanced filter", async () => {
    const res = await getJson({
      accessToken: reader.accessToken,
      app,
      path: `${QUICK_COUNTS_ROUTE}?booksMin=-1`,
    });

    expect(res.status).toBe(400);
  });

  it("returns zero for every chip when nothing is on its way", async () => {
    await expect(quickCounts()).resolves.toEqual(ZERO_COUNTS);
  });

  it("counts every chip over the active books and leaves out received and cancelled ones", async () => {
    await seedInTransitFixture();

    await expect(quickCounts()).resolves.toEqual(SEEDED_COUNTS);
  });

  it("follows the search", async () => {
    await seedInTransitFixture();

    await expect(quickCounts("search=dune")).resolves.toEqual({
      ...ZERO_COUNTS,
      all: 2,
      delayed: 1,
      ordered: 2,
    });
  });

  it("follows the currency and delivery structure filters together", async () => {
    await seedInTransitFixture();

    await expect(quickCounts("currency=UAH&structure=single_shipment")).resolves.toEqual({
      ...ZERO_COUNTS,
      all: 1,
      in_transit: 1,
    });
  });

  it("follows several stores combined with a currency", async () => {
    await seedInTransitFixture();

    await expect(quickCounts("store=Yakaboo&store=Bookva&currency=UAH")).resolves.toEqual({
      ...ZERO_COUNTS,
      all: 3,
      delayed: 1,
      ordered: 3,
    });
  });

  it("ignores the quick filter the request carries", async () => {
    await seedInTransitFixture();

    await expect(quickCounts("filter=in_transit")).resolves.toEqual(SEEDED_COUNTS);
    await expect(quickCounts("filter=delayed&search=dune")).resolves.toEqual(
      await quickCounts("search=dune"),
    );
  });

  it("never counts the books of another user", async () => {
    await seedInTransitFixture();
    const stranger = await context.registerVerifyAndLogin();

    await expect(quickCounts("", stranger.accessToken)).resolves.toEqual(ZERO_COUNTS);
    await expect(quickCounts()).resolves.toEqual(SEEDED_COUNTS);
  });

  it.each([
    "",
    "search=dune",
    "currency=UAH&structure=single_shipment",
    "store=Yakaboo&store=Bookva&currency=UAH",
    `expectedFrom=${isoDay(-10)}&expectedTo=${isoDay(10)}&currency=UAH`,
    "priceCurrency=UAH&priceMin=250",
  ])("promises exactly the list total of every chip for %j", async (query) => {
    await seedInTransitFixture();
    const counts = await quickCounts(query);

    for (const chip of InTransitQuickFilterKeySchema.options) {
      await expect(listTotalForChip({ chip, query })).resolves.toBe(counts[chip]);
    }
  });
});

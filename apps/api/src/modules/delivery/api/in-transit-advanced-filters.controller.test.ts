import type { BookOrderItemRowView, BookOrderView, InTransitFacetsView } from "@app/shared";
import type { INestApplication } from "@nestjs/common";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, AuthTestContext } from "../../../test/auth-test-context.js";

import { createAuthTestContext } from "../../../test/auth-test-context.js";
import { truncateAllTables } from "../../../test/truncate.js";
import { AuthModule } from "../../auth/auth.module.js";
import { BooksModule } from "../../books/books.module.js";
import { ListsModule } from "../../lists/lists.module.js";
import { DeliveryModule } from "../delivery.module.js";
import {
  createBook,
  createOrder,
  getJson,
  isoDay,
  ORDER_ROUTES,
  postJson,
} from "./book-order.fixtures.js";

const FACETS_ROUTE = "/api/delivery/books/in-transit/facets";

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

async function facets(): Promise<InTransitFacetsView> {
  const res = await getJson({ accessToken: reader.accessToken, app, path: FACETS_ROUTE });
  if (res.status !== 200) {
    throw new Error(`facets read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

async function inTransitRows(query: string): Promise<BookOrderItemRowView[]> {
  const res = await getJson({
    accessToken: reader.accessToken,
    app,
    path: `${ORDER_ROUTES.inTransit}?${query}`,
  });
  if (res.status !== 200) {
    throw new Error(`in-transit read failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.items;
}

async function inTransitStores(query: string): Promise<string[]> {
  const rows = await inTransitRows(query);
  return [...new Set(rows.map((row) => row.order.storeName))].sort();
}

async function inTransitTitles(query: string): Promise<string[]> {
  const rows = await inTransitRows(query);
  return rows.map((row) => row.book.title).sort();
}

async function orderWithBook({
  currency,
  orderDate,
  price,
  storeName,
  title,
  totalAmount,
}: {
  currency?: "EUR" | "UAH" | "USD";
  orderDate?: string;
  price?: number;
  storeName: string;
  title: string;
  totalAmount?: number;
}): Promise<BookOrderView> {
  const bookId = await createBook({ accessToken: reader.accessToken, app, title });
  return createOrder({
    accessToken: reader.accessToken,
    app,
    input: {
      items: [{ bookId, ...(price === undefined ? {} : { price }) }],
      storeName,
      ...(currency === undefined ? {} : { currency }),
      ...(orderDate === undefined ? {} : { orderDate }),
      ...(totalAmount === undefined ? {} : { totalAmount }),
    },
  });
}

async function shipItems({
  deliveryService,
  expectedDeliveryDate,
  itemIds,
  order,
}: {
  deliveryService?: string;
  expectedDeliveryDate?: string;
  itemIds: string[];
  order: BookOrderView;
}): Promise<string> {
  const res = await postJson({
    accessToken: reader.accessToken,
    app,
    body: {
      itemIds,
      ...(deliveryService === undefined ? {} : { deliveryService }),
      ...(expectedDeliveryDate === undefined ? {} : { expectedDeliveryDate }),
    },
    path: ORDER_ROUTES.createShipment(order.id),
  });
  if (res.status !== 201) {
    throw new Error(`shipment creation failed with ${res.status}: ${JSON.stringify(res.body)}`);
  }
  const view: BookOrderView = res.body;
  const shipmentId = view.items.find((item) => itemIds.includes(item.id))?.shipmentId;
  if (shipmentId === null || shipmentId === undefined) {
    throw new Error(`no parcel carries ${itemIds.join(", ")}: ${JSON.stringify(view.items)}`);
  }
  return shipmentId;
}

async function shipOneOfTwoBooks({
  looseTitle,
  shippedTitle,
}: {
  looseTitle: string;
  shippedTitle: string;
}): Promise<string> {
  const [shipped, loose] = await Promise.all([
    createBook({ accessToken: reader.accessToken, app, title: shippedTitle }),
    createBook({ accessToken: reader.accessToken, app, title: looseTitle }),
  ]);
  const order = await createOrder({
    accessToken: reader.accessToken,
    app,
    input: { items: [{ bookId: shipped }, { bookId: loose }], storeName: "Yakaboo" },
  });
  const item = order.items.find((candidate) => candidate.bookId === shipped);

  return shipItems({
    deliveryService: "Nova Poshta",
    expectedDeliveryDate: isoDay(3),
    itemIds: [item?.id ?? ""],
    order,
  });
}

describe("in-transit store, currency and price dimensions", () => {
  beforeEach(async () => {
    await orderWithBook({ price: 300, storeName: "Yakaboo", title: "Dune" });
    await orderWithBook({ price: 900, storeName: "Book24", title: "Solaris" });
    await orderWithBook({ currency: "EUR", price: 40, storeName: "Amazon", title: "Neuromancer" });
  });

  it("keeps a single store value working and lets several stand for an OR", async () => {
    expect(await inTransitStores("store=Yakaboo")).toEqual(["Yakaboo"]);
    expect(await inTransitStores("store=Yakaboo&store=Book24")).toEqual(["Book24", "Yakaboo"]);
  });

  it("matches the store name whatever its case", async () => {
    expect(await inTransitStores("store=yakaboo")).toEqual(["Yakaboo"]);
  });

  it("takes any of the named currencies", async () => {
    expect(await inTransitTitles("currency=EUR")).toEqual(["Neuromancer"]);
    expect(await inTransitTitles("currency=EUR&currency=UAH")).toEqual([
      "Dune",
      "Neuromancer",
      "Solaris",
    ]);
  });

  it("filters by the canonical order total once a single currency is named", async () => {
    expect(await inTransitTitles("currency=UAH&priceCurrency=UAH&priceMin=500")).toEqual([
      "Solaris",
    ]);
    expect(
      await inTransitTitles("currency=UAH&priceCurrency=UAH&priceMin=300&priceMax=300"),
    ).toEqual(["Dune"]);
  });

  it("ignores the range when no single currency gates it", async () => {
    expect(await inTransitTitles("priceMin=500")).toEqual(["Dune", "Neuromancer", "Solaris"]);
  });

  it("counts an order with no resolvable total as having no price", async () => {
    await orderWithBook({ storeName: "Yakaboo", title: "Roadside Picnic" });

    expect(await inTransitTitles("pricePresence=unknown")).toEqual(["Roadside Picnic"]);
    expect(await inTransitTitles("pricePresence=known")).toEqual([
      "Dune",
      "Neuromancer",
      "Solaris",
    ]);
  });

  it("leaves an order whose total is unknown out of the numeric range", async () => {
    await orderWithBook({ storeName: "Yakaboo", title: "Roadside Picnic" });

    expect(await inTransitTitles("currency=UAH&priceCurrency=UAH&priceMin=0")).toEqual([
      "Dune",
      "Solaris",
    ]);
  });

  it("treats a zero total as a recorded one", async () => {
    await orderWithBook({ price: 0, storeName: "Yakaboo", title: "Free Copy" });

    expect(await inTransitTitles("pricePresence=known")).toContain("Free Copy");
  });

  it("reads the total off the item breakdown, delivery and discount", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "Hyperion" });
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        deliveryPrice: 100,
        discount: 50,
        items: [{ bookId, price: 400 }],
        storeName: "Yakaboo",
      },
    });

    expect(
      await inTransitTitles("currency=UAH&priceCurrency=UAH&priceMin=450&priceMax=450"),
    ).toEqual(["Hyperion"]);
  });
});

describe("in-transit order date, book count and delivery dimensions", () => {
  it("filters on the order date, falling back to when the order was written down", async () => {
    await orderWithBook({ orderDate: isoDay(-10), storeName: "Yakaboo", title: "Old Order" });
    await orderWithBook({ storeName: "Book24", title: "Dateless Order" });

    expect(await inTransitTitles(`orderedFrom=${isoDay(-1)}`)).toEqual(["Dateless Order"]);
    expect(await inTransitTitles(`orderedTo=${isoDay(-5)}`)).toEqual(["Old Order"]);
    expect(await inTransitTitles(`orderedFrom=${isoDay(-10)}&orderedTo=${isoDay(-10)}`)).toEqual([
      "Old Order",
    ]);
  });

  it("counts the books still on their way, received and cancelled aside", async () => {
    const [first, second, third] = await Promise.all([
      createBook({ accessToken: reader.accessToken, app, title: "Volume One" }),
      createBook({ accessToken: reader.accessToken, app, title: "Volume Two" }),
      createBook({ accessToken: reader.accessToken, app, title: "Volume Three" }),
    ]);
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [{ bookId: first }, { bookId: second }, { bookId: third }],
        storeName: "Yakaboo",
      },
    });
    const cancelled = order.items.find((item) => item.bookId === third);
    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { cancelReason: "Out of stock" },
      path: ORDER_ROUTES.cancelItem(cancelled?.id ?? ""),
    });

    expect(await inTransitTitles("booksMin=2&booksMax=2")).toEqual(["Volume One", "Volume Two"]);
    expect(await inTransitTitles("booksMin=3")).toEqual([]);
  });

  it("keeps every book of an order that matched through one of its parcels", async () => {
    const [first, second] = await Promise.all([
      createBook({ accessToken: reader.accessToken, app, title: "Shipped Book" }),
      createBook({ accessToken: reader.accessToken, app, title: "Loose Book" }),
    ]);
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { items: [{ bookId: first }, { bookId: second }], storeName: "Yakaboo" },
    });
    const shippedItem = order.items.find((item) => item.bookId === first);
    await shipItems({
      deliveryService: "Nova Poshta",
      expectedDeliveryDate: isoDay(3),
      itemIds: [shippedItem?.id ?? ""],
      order,
    });

    expect(await inTransitTitles("service=Nova Poshta")).toEqual(["Loose Book", "Shipped Book"]);
    expect(await inTransitTitles(`expectedFrom=${isoDay(1)}&expectedTo=${isoDay(5)}`)).toEqual([
      "Loose Book",
      "Shipped Book",
    ]);
  });

  it("stops matching an order once its only parcel is cancelled", async () => {
    const shipmentId = await shipOneOfTwoBooks({
      looseTitle: "Still Loose",
      shippedTitle: "Cancelled Parcel",
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      body: { cancelReason: "Lost in the post" },
      path: ORDER_ROUTES.cancelShipment(shipmentId),
    });

    expect(await inTransitTitles("filter=all")).toEqual(["Still Loose"]);
    expect(await inTransitTitles("service=Nova Poshta")).toEqual([]);
    expect(await inTransitTitles(`expectedFrom=${isoDay(1)}&expectedTo=${isoDay(5)}`)).toEqual([]);
  });

  it("stops matching an order once its only parcel has arrived", async () => {
    const shipmentId = await shipOneOfTwoBooks({
      looseTitle: "Still Loose",
      shippedTitle: "Arrived Parcel",
    });
    await postJson({
      accessToken: reader.accessToken,
      app,
      path: ORDER_ROUTES.receiveShipment(shipmentId),
    });

    expect(await inTransitTitles("filter=all")).toEqual(["Still Loose"]);
    expect(await inTransitTitles("service=Nova Poshta")).toEqual([]);
    expect(await inTransitTitles(`expectedFrom=${isoDay(1)}&expectedTo=${isoDay(5)}`)).toEqual([]);
  });

  it("sorts orders by how many uncancelled parcels they carry", async () => {
    await orderWithBook({ storeName: "Yakaboo", title: "No Parcel Yet" });

    const [first, second] = await Promise.all([
      createBook({ accessToken: reader.accessToken, app, title: "Split One" }),
      createBook({ accessToken: reader.accessToken, app, title: "Split Two" }),
    ]);
    const split = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { items: [{ bookId: first }, { bookId: second }], storeName: "Book24" },
    });
    for (const bookId of [first, second]) {
      const item = split.items.find((candidate) => candidate.bookId === bookId);
      await shipItems({ itemIds: [item?.id ?? ""], order: split });
    }

    expect(await inTransitTitles("structure=no_shipment")).toEqual(["No Parcel Yet"]);
    expect(await inTransitTitles("structure=multiple_shipments")).toEqual([
      "Split One",
      "Split Two",
    ]);
    expect(await inTransitTitles("structure=no_shipment&structure=multiple_shipments")).toEqual([
      "No Parcel Yet",
      "Split One",
      "Split Two",
    ]);
  });
});

describe("in-transit advanced filters next to the quick ones", () => {
  it("narrows by both at once", async () => {
    const bookId = await createBook({ accessToken: reader.accessToken, app, title: "In A Parcel" });
    const order = await createOrder({
      accessToken: reader.accessToken,
      app,
      input: { items: [{ bookId }], storeName: "Yakaboo" },
    });
    const item = order.items.find((candidate) => candidate.bookId === bookId);
    const shipmentId = await shipItems({ itemIds: [item?.id ?? ""], order });
    await postJson({
      accessToken: reader.accessToken,
      app,
      body: {},
      path: ORDER_ROUTES.markInTransit(shipmentId),
    });
    await orderWithBook({ storeName: "Book24", title: "Still Waiting" });

    expect(await inTransitTitles("filter=in_transit&store=Yakaboo")).toEqual(["In A Parcel"]);
    expect(await inTransitTitles("filter=in_transit&store=Book24")).toEqual([]);
  });

  it("carries the whole-order total on every row", async () => {
    const [first, second] = await Promise.all([
      createBook({ accessToken: reader.accessToken, app, title: "First Half" }),
      createBook({ accessToken: reader.accessToken, app, title: "Second Half" }),
    ]);
    await createOrder({
      accessToken: reader.accessToken,
      app,
      input: {
        items: [
          { bookId: first, price: 200 },
          { bookId: second, price: 300 },
        ],
        storeName: "Yakaboo",
      },
    });

    const rows = await inTransitRows("pageSize=1");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.order).toMatchObject({
      effectiveTotalAmount: 500,
      itemsCount: 2,
      pricedItemsCount: 2,
    });
  });
});

describe("in-transit facets", () => {
  it("lists the stores and the services of the orders still on their way", async () => {
    await orderWithBook({ storeName: "Yakaboo", title: "Alpha" });
    const beta = await orderWithBook({ storeName: "Yakaboo", title: "Beta" });
    const gamma = await orderWithBook({ storeName: "Book24", title: "Gamma" });

    await shipItems({
      deliveryService: "Nova Poshta",
      itemIds: [beta.items[0]?.id ?? ""],
      order: beta,
    });
    await shipItems({
      deliveryService: "Ukrposhta",
      itemIds: [gamma.items[0]?.id ?? ""],
      order: gamma,
    });

    const view = await facets();

    expect(view.stores).toEqual([
      { count: 2, name: "Yakaboo" },
      { count: 1, name: "Book24" },
    ]);
    expect(view.services).toEqual([
      { count: 1, name: "Nova Poshta" },
      { count: 1, name: "Ukrposhta" },
    ]);
  });
});

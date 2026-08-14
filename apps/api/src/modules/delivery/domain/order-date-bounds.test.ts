import type { z } from "zod";

import {
  BookOrderHistoryQuerySchema,
  BookOrderStatisticsQuerySchema,
  BulkReceiveOrderItemsInputSchema,
  CreateBookOrderInputSchema,
  CreateShipmentInputSchema,
  MarkShipmentInTransitInputSchema,
  MarkShipmentReadyForPickupInputSchema,
  ReceiveShipmentInputSchema,
  UpdateBookOrderInputSchema,
  UpdateShipmentInputSchema,
} from "@app/shared";
import { describe, expect, it } from "vitest";

const BOOK_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const YEAR_ZERO = "0000-01-01";
const EARLIEST_STORABLE_DAY = "0001-01-01";

type DateFieldCase = {
  input: unknown;
  label: string;
  schema: z.ZodType;
};

const dateFieldCases = (day: string): DateFieldCase[] => [
  {
    input: { from: day },
    label: "BookOrderHistoryQuerySchema.from",
    schema: BookOrderHistoryQuerySchema,
  },
  {
    input: { to: day },
    label: "BookOrderHistoryQuerySchema.to",
    schema: BookOrderHistoryQuerySchema,
  },
  {
    input: { from: day },
    label: "BookOrderStatisticsQuerySchema.from",
    schema: BookOrderStatisticsQuerySchema,
  },
  {
    input: { to: day },
    label: "BookOrderStatisticsQuerySchema.to",
    schema: BookOrderStatisticsQuerySchema,
  },
  {
    input: { bookIds: [BOOK_ID], receivedAt: day },
    label: "BulkReceiveOrderItemsInputSchema.receivedAt",
    schema: BulkReceiveOrderItemsInputSchema,
  },
  {
    input: { items: [{ bookId: BOOK_ID }], orderDate: day, storeName: "Bookstore" },
    label: "CreateBookOrderInputSchema.orderDate",
    schema: CreateBookOrderInputSchema,
  },
  {
    input: {
      items: [{ bookId: BOOK_ID }],
      shipments: [{ bookIds: [BOOK_ID], expectedDeliveryDate: day }],
      storeName: "Bookstore",
    },
    label: "CreateBookOrderInputSchema.shipments.expectedDeliveryDate",
    schema: CreateBookOrderInputSchema,
  },
  {
    input: { expectedDeliveryDate: day, itemIds: [ITEM_ID] },
    label: "CreateShipmentInputSchema.expectedDeliveryDate",
    schema: CreateShipmentInputSchema,
  },
  {
    input: { itemIds: [ITEM_ID], pickupUntil: day },
    label: "CreateShipmentInputSchema.pickupUntil",
    schema: CreateShipmentInputSchema,
  },
  {
    input: { expectedDeliveryDate: day },
    label: "MarkShipmentInTransitInputSchema.expectedDeliveryDate",
    schema: MarkShipmentInTransitInputSchema,
  },
  {
    input: { pickupUntil: day },
    label: "MarkShipmentReadyForPickupInputSchema.pickupUntil",
    schema: MarkShipmentReadyForPickupInputSchema,
  },
  {
    input: { receivedAt: day },
    label: "ReceiveShipmentInputSchema.receivedAt",
    schema: ReceiveShipmentInputSchema,
  },
  {
    input: { orderDate: day },
    label: "UpdateBookOrderInputSchema.orderDate",
    schema: UpdateBookOrderInputSchema,
  },
  {
    input: { expectedDeliveryDate: day },
    label: "UpdateShipmentInputSchema.expectedDeliveryDate",
    schema: UpdateShipmentInputSchema,
  },
  {
    input: { pickupUntil: day },
    label: "UpdateShipmentInputSchema.pickupUntil",
    schema: UpdateShipmentInputSchema,
  },
];

describe("order date fields reject a year the database cannot store", () => {
  for (const dateFieldCase of dateFieldCases(YEAR_ZERO)) {
    it(`rejects year zero on ${dateFieldCase.label}`, () => {
      expect(dateFieldCase.schema.safeParse(dateFieldCase.input).success).toBe(false);
    });
  }

  for (const dateFieldCase of dateFieldCases(EARLIEST_STORABLE_DAY)) {
    it(`accepts ${EARLIEST_STORABLE_DAY} on ${dateFieldCase.label}`, () => {
      expect(dateFieldCase.schema.safeParse(dateFieldCase.input).success).toBe(true);
    });
  }
});

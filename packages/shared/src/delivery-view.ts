import { z } from "zod";

import { CurrencySchema, ShipmentStatusSchema } from "./book-enums.js";

export const DeliveryViewSchema = z.object({
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.string(),
  currency: CurrencySchema.nullable(),
  deliveryService: z.string().nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  isFree: z.boolean().describe("The order this book arrived in was received for free."),
  note: z.string().nullable(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
  status: ShipmentStatusSchema,
  storeName: z.string().nullable(),
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  updatedAt: z.string(),
});

export type DeliveryView = z.infer<typeof DeliveryViewSchema>;

export const DeliverySummaryViewSchema = z.object({
  active: DeliveryViewSchema.nullable(),
  latest: DeliveryViewSchema.nullable(),
  totalCount: z.number(),
});

export type DeliverySummaryView = z.infer<typeof DeliverySummaryViewSchema>;

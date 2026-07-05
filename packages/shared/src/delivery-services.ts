import { z } from "zod";

import { collapseSpaces } from "./common.js";
import { NoHtmlString, RECENT_USED_LIMIT_DEFAULT, RECENT_USED_LIMIT_MAX } from "./internal.js";

const DELIVERY_SERVICE_MIN = 2;
const DELIVERY_SERVICE_MAX = 100;

export const DeliveryServiceSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(
      DELIVERY_SERVICE_MIN,
      "Delivery service must be at least 2 characters long",
    ).max(DELIVERY_SERVICE_MAX, "Delivery service must be at most 100 characters long"),
  );

export const DeliveryServiceViewSchema = z.object({
  countryCode: z.string().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
});

export type DeliveryServiceView = z.infer<typeof DeliveryServiceViewSchema>;

export const RecentDeliveryServicesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RECENT_USED_LIMIT_MAX)
    .default(RECENT_USED_LIMIT_DEFAULT),
});

export type RecentDeliveryServicesQuery = z.infer<typeof RecentDeliveryServicesQuerySchema>;

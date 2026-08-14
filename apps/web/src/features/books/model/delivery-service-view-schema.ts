import type { DeliveryServiceView } from "@app/shared";

import { z } from "zod";

export const deliveryServiceViewSchema = z.object({
  countryCode: z.string().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
  providerKey: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
  trackingUrlTemplate: z
    .string()
    .nullish()
    .transform((value) => value ?? null),
}) satisfies z.ZodType<DeliveryServiceView>;

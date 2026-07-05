import type { DeliveryServiceView } from "@app/shared";

import { z } from "zod";

export const deliveryServiceViewSchema = z.object({
  countryCode: z.string().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  name: z.string(),
}) satisfies z.ZodType<DeliveryServiceView>;

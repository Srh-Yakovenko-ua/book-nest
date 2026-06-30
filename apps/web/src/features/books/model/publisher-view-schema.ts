import type { PublisherView } from "@app/shared";

import { z } from "zod";

export const publisherViewSchema = z.object({
  countryCode: z.string().nullable(),
  foundedYear: z.number().nullable(),
  id: z.string(),
  isCustom: z.boolean(),
  logoAttribution: z.string().nullable(),
  logoLicense: z.string().nullable(),
  logoLicenseUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  name: z.string(),
  websiteUrl: z.string().nullable(),
}) satisfies z.ZodType<PublisherView>;

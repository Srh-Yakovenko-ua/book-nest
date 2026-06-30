import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const host = env.NEXT_PUBLIC_SITE_URL;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((locale) => [locale, `${host}/${locale}`]),
        ),
      },
      url: `${host}/${routing.defaultLocale}`,
    },
  ];
}

import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const host = env.NEXT_PUBLIC_SITE_URL;

const ROUTES = ["", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${host}/${locale}${path}`]),
      ),
    },
    url: `${host}/${routing.defaultLocale}${path}`,
  }));
}

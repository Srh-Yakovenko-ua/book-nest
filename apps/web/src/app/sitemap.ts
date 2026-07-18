import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";
import { buildHreflang } from "@/lib/seo";

const SITE_URL = env.NEXT_PUBLIC_SITE_URL;

const PUBLIC_ROUTES = [
  { changeFrequency: "monthly", path: "/login", priority: 0.8 },
  { changeFrequency: "monthly", path: "/register", priority: 0.8 },
  { changeFrequency: "yearly", path: "/privacy", priority: 0.3 },
  { changeFrequency: "yearly", path: "/terms", priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map(({ changeFrequency, path, priority }) => ({
    alternates: { languages: buildHreflang({ pathname: path }) },
    changeFrequency,
    lastModified,
    priority,
    url: `${SITE_URL}/${routing.defaultLocale}${path}`,
  }));
}

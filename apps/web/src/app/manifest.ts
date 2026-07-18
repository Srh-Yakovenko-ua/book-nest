import type { MetadataRoute } from "next";

import { getTranslations } from "next-intl/server";

import { routing } from "@/i18n/routing";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations({ locale: routing.defaultLocale, namespace: "home" });

  return {
    background_color: "#F6F0E7",
    description: t("description"),
    display: "standalone",
    icons: [{ sizes: "any", src: "/favicon.svg", type: "image/svg+xml" }],
    name: "book-nest",
    short_name: "book-nest",
    start_url: "/",
    theme_color: "#A96E47",
  };
}

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: "ru",
  locales: ["ru", "en", "uk"],
});

export type Locale = (typeof routing.locales)[number];

export const LOCALES = routing.locales;

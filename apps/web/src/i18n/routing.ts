import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  defaultLocale: "uk",
  locales: ["uk", "en"],
});

export type Locale = (typeof routing.locales)[number];

export const LOCALES = routing.locales;

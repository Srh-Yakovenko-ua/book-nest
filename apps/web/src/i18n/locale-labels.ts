import type { Locale } from "./routing";

export const LOCALE_LABELS = {
  en: "English",
  uk: "Українська",
} as const satisfies Record<Locale, string>;

import { z } from "zod";

export const LocaleSchema = z.enum(["ru", "en", "uk"]);

export type Locale = z.infer<typeof LocaleSchema>;

export const LOCALES = LocaleSchema.options;

const STORAGE_KEY = "app.locale";

export function getStoredLocale(): Locale {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = LocaleSchema.safeParse(raw);
  return parsed.success ? parsed.data : "ru";
}

export function setStoredLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

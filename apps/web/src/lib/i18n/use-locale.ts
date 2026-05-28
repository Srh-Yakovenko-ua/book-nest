import { useTranslation } from "react-i18next";

import type { Locale } from "./schema";

import { LocaleSchema, setStoredLocale } from "./schema";

export function useLocale() {
  const { i18n } = useTranslation();

  const parsed = LocaleSchema.safeParse(i18n.language);
  const locale: Locale = parsed.success ? parsed.data : "ru";

  function setLocale(next: Locale) {
    void i18n.changeLanguage(next);
    setStoredLocale(next);
  }

  return { locale, setLocale };
}

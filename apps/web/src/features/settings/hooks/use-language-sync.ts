"use client";

import type { InterfaceLanguage, Nullable } from "@app/shared";

import { InterfaceLanguageSchema } from "@app/shared";
import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";

import { useSettings } from "../api/use-settings";
import { useUpdateSettings } from "../api/use-update-settings";

export function useLanguageSync() {
  const locale = useLocale();
  const settings = useSettings();
  const { isPending: isSyncing, mutate: updateSettings } = useUpdateSettings();
  const attemptedLanguage = useRef<Nullable<InterfaceLanguage>>(null);

  const storedLanguage = settings.isSuccess ? settings.data.language : null;

  useEffect(() => {
    if (storedLanguage === null) return;
    if (isSyncing) return;
    if (!isInterfaceLanguage(locale)) return;
    if (storedLanguage === locale) return;
    if (attemptedLanguage.current === locale) return;

    attemptedLanguage.current = locale;
    updateSettings({ language: locale });
  }, [isSyncing, locale, storedLanguage, updateSettings]);
}

function isInterfaceLanguage(value: string): value is InterfaceLanguage {
  return InterfaceLanguageSchema.safeParse(value).success;
}

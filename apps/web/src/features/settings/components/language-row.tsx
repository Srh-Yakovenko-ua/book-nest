"use client";

import type { Nullable } from "@app/shared";

import { hasLocale, useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useOptimistic, useRef, useTransition } from "react";

import { Segmented } from "@/components/ui/segmented";
import { LOCALE_LABELS } from "@/i18n/locale-labels";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, LOCALES } from "@/i18n/routing";

const LOCALE_SWITCH_FOCUS: { pendingLocale: Nullable<Locale> } = { pendingLocale: null };

export function LanguageRow() {
  const t = useTranslations("settings.appearance.language");
  const generatedId = useId();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const segmentedRef = useRef<HTMLDivElement>(null);
  const [displayedLocale, setDisplayedLocale] = useOptimistic(locale);
  const [isSwitching, startSwitching] = useTransition();

  const hintId = `settings-language-hint-${generatedId}`;

  useEffect(() => {
    const arrivedFromSwitch = LOCALE_SWITCH_FOCUS.pendingLocale === locale;
    LOCALE_SWITCH_FOCUS.pendingLocale = null;
    if (arrivedFromSwitch) segmentedRef.current?.focus();
  }, [locale]);

  function switchLocale(next: string) {
    if (isSwitching) return;
    if (!hasLocale(LOCALES, next)) return;
    startSwitching(() => {
      setDisplayedLocale(next);
      LOCALE_SWITCH_FOCUS.pendingLocale = next;
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <p className="text-sm leading-none font-medium">{t("label")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint")}
        </p>
      </div>
      <Segmented
        aria-describedby={hintId}
        aria-disabled={isSwitching}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        label={t("label")}
        onValueChange={switchLocale}
        options={LOCALES.map((option) => ({
          label: <span lang={option}>{LOCALE_LABELS[option]}</span>,
          value: option,
        }))}
        ref={segmentedRef}
        value={displayedLocale}
      />
    </div>
  );
}

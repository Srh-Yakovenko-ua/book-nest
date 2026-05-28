import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Locale, LOCALES, LocaleSchema } from "@/lib/i18n/schema";
import { useLocale } from "@/lib/i18n/use-locale";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ru: "Русский",
  uk: "Українська",
};

const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  ru: "RU",
  uk: "UK",
};

export function LocalePicker() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation();

  function handleLocaleSelect(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const parsed = LocaleSchema.safeParse(target.dataset.locale);
    if (!parsed.success) return;
    setLocale(parsed.data);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("localePicker.ariaLabel")}
          className="h-9 rounded-lg px-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase transition-all duration-150 hover:bg-muted hover:text-foreground"
          variant="ghost"
        >
          {LOCALE_SHORT[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LOCALES.map((loc) => (
          <DropdownMenuItem
            className="cursor-pointer font-mono text-[11px] tracking-[0.12em]"
            data-locale={loc}
            key={loc}
            onSelect={handleLocaleSelect}
          >
            <span
              className={cn(
                "mr-2 font-mono text-[9px] tracking-[0.18em] uppercase",
                locale === loc ? "text-primary" : "text-muted-foreground",
              )}
            >
              {LOCALE_SHORT[loc]}
            </span>
            <span className={cn(locale === loc ? "text-foreground" : "text-muted-foreground")}>
              {LOCALE_LABELS[loc]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

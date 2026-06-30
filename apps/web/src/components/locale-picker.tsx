"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, LOCALES, routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  uk: "Українська",
};

const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  uk: "UK",
};

export function LocalePicker({ triggerClassName }: { triggerClassName?: string }) {
  const locale = useLocale();
  const t = useTranslations("localePicker");
  const router = useRouter();
  const pathname = usePathname();

  function handleLocaleSelect(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const value = target.dataset.locale;
    if (!value || !isLocale(value)) return;
    router.replace(pathname, { locale: value });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("ariaLabel")}
          className={cn(
            "h-9 rounded-lg px-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase transition-all duration-150 hover:bg-muted hover:text-foreground",
            triggerClassName,
          )}
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

function isLocale(value: string): value is Locale {
  return (routing.locales as readonly string[]).includes(value);
}

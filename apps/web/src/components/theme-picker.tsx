"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeValue = "dark" | "light" | "system";

const OPTIONS: ReadonlyArray<{ Icon: typeof Sun; value: ThemeValue }> = [
  { Icon: Sun, value: "light" },
  { Icon: Moon, value: "dark" },
  { Icon: Monitor, value: "system" },
];

const OPTION_LABEL_KEY = {
  dark: "options.dark",
  light: "options.light",
  system: "options.system",
} as const satisfies Record<ThemeValue, `options.${ThemeValue}`>;

const THEME_VALUES: ReadonlySet<string> = new Set<ThemeValue>(["dark", "light", "system"]);

const subscribeMounted = () => () => {};
const getMountedClientSnapshot = () => true;
const getMountedServerSnapshot = () => false;

export function ThemePicker({ triggerClassName }: { triggerClassName?: string }) {
  const t = useTranslations("themePicker");
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeMounted,
    getMountedClientSnapshot,
    getMountedServerSnapshot,
  );

  const TriggerIcon = mounted && resolvedTheme === "dark" ? Moon : Sun;

  function handleThemeSelect(event: Event) {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    const value = target.dataset.theme;
    if (!value || !THEME_VALUES.has(value)) return;
    setTheme(value);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("ariaLabel")}
          className={cn(
            "size-9 rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground",
            triggerClassName,
          )}
          size="icon"
          suppressHydrationWarning
          variant="ghost"
        >
          <TriggerIcon className="size-[15px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {OPTIONS.map(({ Icon, value }) => (
          <DropdownMenuItem
            className="cursor-pointer font-mono text-[11px] tracking-[0.18em] uppercase"
            data-theme={value}
            key={value}
            onSelect={handleThemeSelect}
          >
            <Icon
              className={cn(
                "mr-2 size-3.5",
                theme === value ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span className={cn(theme === value ? "text-foreground" : "text-muted-foreground")}>
              {t(OPTION_LABEL_KEY[value])}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

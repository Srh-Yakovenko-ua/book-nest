"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useId, useSyncExternalStore } from "react";

import { Segmented } from "@/components/ui/segmented";

const THEME_OPTIONS = [
  { Icon: Sun, labelKey: "options.light", value: "light" },
  { Icon: Moon, labelKey: "options.dark", value: "dark" },
  { Icon: Monitor, labelKey: "options.system", value: "system" },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]["value"];

const MOUNTED_STORE = {
  getClientSnapshot: () => true,
  getServerSnapshot: () => false,
  subscribe: () => () => {},
} as const;

export function ThemeRow() {
  const t = useTranslations("settings.appearance.theme");
  const tThemeOptions = useTranslations("themePicker");
  const generatedId = useId();
  const { setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    MOUNTED_STORE.subscribe,
    MOUNTED_STORE.getClientSnapshot,
    MOUNTED_STORE.getServerSnapshot,
  );

  const hintId = `settings-theme-hint-${generatedId}`;
  const selectedTheme = mounted ? (theme ?? "") : "";

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-1">
        <p className="text-sm leading-none font-medium">{t("label")}</p>
        <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
          {t("hint")}
        </p>
      </div>
      <div className="w-full sm:w-auto">
        <Segmented
          aria-describedby={hintId}
          block
          className="max-sm:*:gap-1 max-sm:*:px-2"
          label={t("label")}
          onValueChange={(next) => {
            if (isThemeValue(next)) setTheme(next);
          }}
          options={THEME_OPTIONS.map(({ Icon, labelKey, value }) => ({
            icon: <Icon />,
            label: tThemeOptions(labelKey),
            value,
          }))}
          value={selectedTheme}
        />
      </div>
    </div>
  );
}

function isThemeValue(value: string): value is ThemeValue {
  return THEME_OPTIONS.some((option) => option.value === value);
}

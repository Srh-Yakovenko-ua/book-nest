"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ThemeValue = "dark" | "light" | "system";

const OPTIONS: ReadonlyArray<{ Icon: typeof Sun; label: string; value: ThemeValue }> = [
  { Icon: Sun, label: "Light", value: "light" },
  { Icon: Moon, label: "Dark", value: "dark" },
  { Icon: Monitor, label: "System", value: "system" },
];

const THEME_VALUES: ReadonlySet<string> = new Set<ThemeValue>(["dark", "light", "system"]);

export function ThemePicker() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const TriggerIcon = resolvedTheme === "dark" ? Moon : Sun;

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
          aria-label="Change theme"
          className="size-9 rounded-lg text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground"
          size="icon"
          variant="ghost"
        >
          <TriggerIcon className="size-[15px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        {OPTIONS.map(({ Icon, label, value }) => (
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
              {label}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

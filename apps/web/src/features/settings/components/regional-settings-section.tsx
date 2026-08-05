"use client";

import type { WeekStartDay } from "@app/shared";

import { WeekStartDaySchema } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";

import { useUpdateSettings } from "../api/use-update-settings";

const WEEK_START_OPTIONS: readonly WeekStartDay[] = ["monday", "sunday"];

const TIMEZONE_LIST = {
  canonicalise: (zone: string): string => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
    } catch {
      return zone;
    }
  },
  sort: (zones: readonly string[]): readonly string[] =>
    [...zones].sort((a, b) => a.localeCompare(b)),
  supported: Intl.supportedValuesOf("timeZone"),
} as const;

type RegionalSettingsSectionProps = {
  timezone: string;
  weekStartDay: WeekStartDay;
};

export function RegionalSettingsSection({ timezone, weekStartDay }: RegionalSettingsSectionProps) {
  const t = useTranslations("settings.regional");

  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <TimezoneRow timezone={timezone} />
        <WeekStartRow weekStartDay={weekStartDay} />
      </CardContent>
    </Card>
  );
}

function isWeekStartDay(value: string): value is WeekStartDay {
  return WeekStartDaySchema.safeParse(value).success;
}

function timezoneOptions(timezone: string): readonly string[] {
  const storedZone = TIMEZONE_LIST.canonicalise(timezone);
  const withoutStoredAlias = TIMEZONE_LIST.supported.filter(
    (zone) => zone === timezone || TIMEZONE_LIST.canonicalise(zone) !== storedZone,
  );

  return TIMEZONE_LIST.sort(
    withoutStoredAlias.includes(timezone) ? withoutStoredAlias : [...withoutStoredAlias, timezone],
  );
}

function TimezoneRow({ timezone }: { timezone: string }) {
  const t = useTranslations("settings.regional");
  const tToast = useTranslations("settings.toast");
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const updateSettings = useUpdateSettings();

  const triggerId = `settings-timezone-${generatedId}`;
  const hintId = `settings-timezone-hint-${generatedId}`;
  const value = updateSettings.isPending
    ? (updateSettings.variables?.timezone ?? timezone)
    : timezone;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={triggerId}>{t("timezone.label")}</Label>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-describedby={hintId}
            className="w-full justify-between font-normal sm:max-w-sm"
            id={triggerId}
            type="button"
            variant="outline"
          >
            <span className="truncate">{value}</span>
            <UiIcon className="ml-2 shrink-0 opacity-60" name="chevron-down" size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput placeholder={t("timezone.search")} />
            <CommandList>
              <CommandEmpty>{t("timezone.empty")}</CommandEmpty>
              <CommandGroup>
                {timezoneOptions(value).map((option) => (
                  <CommandItem
                    className="cursor-pointer justify-between gap-2"
                    key={option}
                    onSelect={() => {
                      setOpen(false);
                      if (option === value) return;
                      updateSettings.mutate(
                        { timezone: option },
                        {
                          onError: () => toast.error(tToast("error")),
                          onSuccess: () => toast.success(tToast("saved")),
                        },
                      );
                    }}
                    value={option}
                  >
                    <span className="min-w-0 truncate">{option}</span>
                    {option === value ? (
                      <UiIcon className="shrink-0 text-primary" name="check" size={16} />
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-xs leading-relaxed text-muted-foreground" id={hintId}>
        {t("timezone.hint")}
      </p>
    </div>
  );
}

function WeekStartRow({ weekStartDay }: { weekStartDay: WeekStartDay }) {
  const t = useTranslations("settings.regional");
  const tToast = useTranslations("settings.toast");
  const updateSettings = useUpdateSettings();

  const value = updateSettings.isPending
    ? (updateSettings.variables?.weekStartDay ?? weekStartDay)
    : weekStartDay;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">{t("weekStartDay.label")}</p>
      <Segmented
        label={t("weekStartDay.label")}
        onValueChange={(next) => {
          if (!isWeekStartDay(next) || next === value) return;
          updateSettings.mutate(
            { weekStartDay: next },
            {
              onError: () => toast.error(tToast("error")),
              onSuccess: () => toast.success(tToast("saved")),
            },
          );
        }}
        options={WEEK_START_OPTIONS.map((option) => ({
          label: t(`weekStartDay.${option}`),
          value: option,
        }))}
        value={value}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{t("weekStartDay.hint")}</p>
    </div>
  );
}

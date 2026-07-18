"use client";

import type { SeriesStatus } from "@app/shared";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { ChipGroup } from "@/components/ui/chip-group";

const SERIES_STATUS_CONFIG = [
  { icon: "check-circle", value: "completed" },
  { icon: "clock", value: "ongoing" },
  { icon: "help-circle", value: "unknown" },
] as const satisfies readonly { icon: UiIconName; value: SeriesStatus }[];

type SeriesStatusChipsProps = {
  label: string;
  onChange: (value: SeriesStatus) => void;
  value: SeriesStatus;
};

export function SeriesStatusChips({ label, onChange, value }: SeriesStatusChipsProps) {
  const tStatus = useTranslations("series.status");

  return (
    <ChipGroup
      label={label}
      mode="single"
      onValueChange={(next) => onChange(next as SeriesStatus)}
      options={SERIES_STATUS_CONFIG.map((option) => ({
        icon: <UiIcon name={option.icon} size={16} />,
        label: tStatus(option.value),
        value: option.value,
      }))}
      size="sm"
      value={value}
    />
  );
}

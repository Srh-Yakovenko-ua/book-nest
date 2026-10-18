"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Segmented } from "@/components/ui/segmented";

import type { CharactersViewMode } from "../model/characters-view-mode";

import { CHARACTERS_VIEW, toCharactersViewMode } from "../model/characters-view-mode";

const VIEW_MODE_ICON = {
  graph: "share",
  list: "users-round",
  relationships: "link",
} as const satisfies Record<CharactersViewMode, UiIconName>;

type CharactersViewModesProps = {
  onChange: (mode: CharactersViewMode) => void;
  value: CharactersViewMode;
};

export function CharactersViewModes({ onChange, value }: CharactersViewModesProps) {
  const t = useTranslations("characters.viewModes");

  return (
    <Segmented
      className="w-full sm:w-fit"
      label={t("label")}
      onValueChange={(next) => {
        const mode = toCharactersViewMode(next);
        if (mode !== undefined) onChange(mode);
      }}
      options={CHARACTERS_VIEW.modes.map((mode) => ({
        icon: <UiIcon className="hidden sm:block" name={VIEW_MODE_ICON[mode]} size={16} />,
        label: t(mode),
        value: mode,
      }))}
      tone="accent"
      value={value}
    />
  );
}

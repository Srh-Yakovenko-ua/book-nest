"use client";

import type { RefCallback } from "react";

import { CHARACTER_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";

import {
  CHARACTER_PRONOUNS,
  type PronounsOption,
  pronounsOptionOf,
} from "../model/character-pronouns";
import { CharacterCreatableSingleSelect } from "./character-creatable-single-select";

type CharacterPronounsSelectProps = {
  describedBy: string | undefined;
  inputId: string;
  invalid: boolean;
  label: string;
  onBlur: () => void;
  onChange: (pronouns: string) => void;
  ref: RefCallback<HTMLInputElement>;
  saved: boolean;
  value: string;
};

export function CharacterPronounsSelect({
  describedBy,
  inputId,
  invalid,
  label,
  onBlur,
  onChange,
  ref,
  saved,
  value,
}: CharacterPronounsSelectProps) {
  const t = useTranslations("characters.pronouns");
  const option = pronounsOptionOf(value, (preset) => t(preset));

  function labelOf(candidate: PronounsOption) {
    if (candidate === CHARACTER_PRONOUNS.none || candidate === CHARACTER_PRONOUNS.custom) return "";
    return t(candidate);
  }

  function textFor(chosen: PronounsOption, customText: string) {
    if (chosen === CHARACTER_PRONOUNS.custom) return customText;
    if (chosen === option) return value;
    return labelOf(chosen);
  }

  return (
    <CharacterCreatableSingleSelect
      clearTo={CHARACTER_PRONOUNS.none}
      customText={option === CHARACTER_PRONOUNS.custom ? value : ""}
      customTextSaved={saved}
      describedBy={describedBy}
      inputId={inputId}
      invalid={invalid}
      label={label}
      maxLength={CHARACTER_TEXT_MAX.pronouns}
      onBlur={onBlur}
      onChange={(choice) => onChange(textFor(choice.option, choice.customText))}
      optionLabel={labelOf}
      options={CHARACTER_PRONOUNS.presets}
      ref={ref}
      sentinel={CHARACTER_PRONOUNS.custom}
      value={option}
    />
  );
}

"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { bookFormats } from "@/lib/book-status";

type BookFormatFilterProps<TFormat extends BookFormatValue> = {
  onValueChange: (value: TFormat[]) => void;
  options: readonly TFormat[];
  value: TFormat[];
};

type BookFormatValue = (typeof bookFormats)[number]["value"];

export function BookFormatFilter<TFormat extends BookFormatValue>({
  onValueChange,
  options,
  value,
}: BookFormatFilterProps<TFormat>) {
  const t = useTranslations("books.format");
  const tOptions = useTranslations("books.format.options");
  const title = t("filterTitle");

  return (
    <FilterSection title={title}>
      <ChipGroup
        label={title}
        mode="multi"
        onValueChange={(next) => onValueChange(options.filter((option) => next.includes(option)))}
        options={options.map((option: BookFormatValue) => {
          const entry = bookFormats.find((item) => item.value === option);
          return {
            icon: entry ? <UiIcon name={entry.icon} /> : undefined,
            label: tOptions(option),
            value: option,
          };
        })}
        size="sm"
        value={value}
      />
    </FilterSection>
  );
}

"use client";

import type { FieldError } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FieldError as FieldErrorText } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { CharacterAliasRow } from "../model/character-aliases";

import { ALIAS_DEFAULT_TYPE, emptyAliasRow } from "../model/character-aliases";
import { ALIAS_TYPE_OPTIONS } from "../model/character-options";

type CharacterAliasGroupProps = {
  description: string;
  errors: (FieldError | undefined)[];
  idPrefix: string;
  onChange: (aliases: CharacterAliasRow[]) => void;
  title: string;
  value: CharacterAliasRow[];
};

export function CharacterAliasGroup({
  description,
  errors,
  idPrefix,
  onChange,
  title,
  value,
}: CharacterAliasGroupProps) {
  const t = useTranslations("characters.aliases");

  function updateRow(index: number, patch: Partial<CharacterAliasRow>) {
    onChange(value.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {value.map((row, index) => (
        <AliasRowEditor
          error={errors[index]}
          id={`${idPrefix}-${index}`}
          key={index}
          onChange={(patch) => updateRow(index, patch)}
          onRemove={() => onChange(value.filter((_, current) => current !== index))}
          row={row}
        />
      ))}

      <Button
        className="self-start"
        onClick={() => onChange([...value, emptyAliasRow()])}
        size="sm"
        type="button"
        variant="secondary"
      >
        <UiIcon name="plus" size={14} />
        {t("add")}
      </Button>
    </div>
  );
}

function AliasRowEditor({
  error,
  id,
  onChange,
  onRemove,
  row,
}: {
  error: FieldError | undefined;
  id: string;
  onChange: (patch: Partial<CharacterAliasRow>) => void;
  onRemove: () => void;
  row: CharacterAliasRow;
}) {
  const t = useTranslations("characters.aliases");
  const tType = useTranslations("characters.aliasType");
  const [advancedOpen, setAdvancedOpen] = useState(
    row.isSpoiler || row.type !== ALIAS_DEFAULT_TYPE,
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Input
          aria-invalid={error !== undefined}
          aria-label={t("name")}
          className="h-10"
          id={id}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder={t("namePlaceholder")}
          value={row.name}
        />
        <Button
          aria-label={t("remove")}
          className="shrink-0"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <UiIcon name="trash" size={16} />
        </Button>
      </div>

      <FieldErrorText error={error} id={`${id}-error`} />

      {advancedOpen ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select onValueChange={(next) => onChange({ type: toAliasType(next) })} value={row.type}>
            <SelectTrigger aria-label={t("type")} className="w-full data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALIAS_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tType(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={row.isSpoiler}
              onCheckedChange={(checked) => onChange({ isSpoiler: checked })}
            />
            {t("spoiler")}
          </label>
        </div>
      ) : (
        <Button
          className="h-auto self-start p-0"
          onClick={() => setAdvancedOpen(true)}
          size="xs"
          type="button"
          variant="link"
        >
          {t("advanced")}
        </Button>
      )}
    </div>
  );
}

function toAliasType(value: string): CharacterAliasRow["type"] {
  return ALIAS_TYPE_OPTIONS.find((option) => option === value) ?? ALIAS_DEFAULT_TYPE;
}

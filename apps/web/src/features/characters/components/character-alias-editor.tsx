"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { CharacterFormValues } from "../model/character-form-schema";

import { ALIAS_TYPE_OPTIONS } from "../model/character-options";

type AliasRow = CharacterFormValues["aliases"][number];

const ALIAS_SCOPE_OPTIONS = ["global", "book"] as const;

type CharacterAliasEditorProps = {
  onChange: (aliases: AliasRow[]) => void;
  value: AliasRow[];
};

export function CharacterAliasEditor({ onChange, value }: CharacterAliasEditorProps) {
  const t = useTranslations("characters.aliasEditor");
  const tType = useTranslations("characters.aliasType");

  function updateRow(index: number, patch: Partial<AliasRow>) {
    onChange(value.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, current) => current !== index));
  }

  function addRow() {
    onChange([...value, { isSpoiler: false, name: "", scope: "global", type: "nickname" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((row, index) => (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3" key={index}>
          <div className="flex items-center gap-2">
            <Input
              aria-label={t("name")}
              className="h-10"
              onChange={(event) => updateRow(index, { name: event.target.value })}
              placeholder={t("namePlaceholder")}
              value={row.name}
            />
            <Button
              aria-label={t("remove")}
              className="shrink-0"
              onClick={() => removeRow(index)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <UiIcon name="trash" size={16} />
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Select
              onValueChange={(next) => updateRow(index, { type: toAliasType(next) })}
              value={row.type}
            >
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

            <Select
              onValueChange={(next) => updateRow(index, { scope: toAliasScope(next) })}
              value={row.scope}
            >
              <SelectTrigger aria-label={t("scope")} className="w-full data-[size=default]:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">{t("scopeGlobal")}</SelectItem>
                <SelectItem value="book">{t("scopeBook")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              aria-label={t("spoiler")}
              checked={row.isSpoiler}
              onCheckedChange={(checked) => updateRow(index, { isSpoiler: checked })}
            />
            <span>{t("spoiler")}</span>
          </div>
        </div>
      ))}

      <Button className="self-start" onClick={addRow} size="sm" type="button" variant="secondary">
        <UiIcon name="plus" size={14} />
        {t("add")}
      </Button>
    </div>
  );
}

function toAliasScope(value: string): AliasRow["scope"] {
  return ALIAS_SCOPE_OPTIONS.find((option) => option === value) ?? "global";
}

function toAliasType(value: string): AliasRow["type"] {
  return ALIAS_TYPE_OPTIONS.find((option) => option === value) ?? "nickname";
}

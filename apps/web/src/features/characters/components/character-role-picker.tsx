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

import { ROLE_TYPE_CUSTOM, ROLE_TYPE_OPTIONS } from "../model/character-options";

type CharacterRolePickerProps = {
  onChange: (roles: RoleRow[]) => void;
  value: RoleRow[];
};

type RoleRow = CharacterFormValues["roles"][number];

export function CharacterRolePicker({ onChange, value }: CharacterRolePickerProps) {
  const t = useTranslations("characters.rolePicker");
  const tRole = useTranslations("characters.roleType");

  function updateRow(index: number, patch: Partial<RoleRow>) {
    onChange(value.map((row, current) => (current === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, current) => current !== index));
  }

  function addRow() {
    onChange([...value, { customRole: "", isSpoiler: false, roleType: "supporting" }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {value.map((row, index) => (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3" key={index}>
          <div className="flex items-center gap-2">
            <Select
              onValueChange={(next) => updateRow(index, { roleType: toRoleType(next) })}
              value={row.roleType}
            >
              <SelectTrigger aria-label={t("roleType")} className="w-full data-[size=default]:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {tRole(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          {row.roleType === ROLE_TYPE_CUSTOM ? (
            <Input
              aria-label={t("customPlaceholder")}
              className="h-10"
              onChange={(event) => updateRow(index, { customRole: event.target.value })}
              placeholder={t("customPlaceholder")}
              value={row.customRole}
            />
          ) : null}

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

function toRoleType(value: string): RoleRow["roleType"] {
  return ROLE_TYPE_OPTIONS.find((option) => option === value) ?? "supporting";
}

"use client";

import type { Nullable } from "@app/shared";
import type { KeyboardEvent, RefObject } from "react";

import { CHARACTER_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { CharacterAliasRow } from "../model/character-aliases";
import type { CharacterEditScope } from "../model/character-edit-form";

import { ALIAS_DEFAULT_TYPE } from "../model/character-aliases";
import { ALIAS_TYPE_OPTIONS } from "../model/character-options";

type CharacterAliasEditorProps = {
  canConfirm: boolean;
  draft: CharacterAliasRow;
  error: Nullable<string>;
  nameRef: RefObject<Nullable<HTMLInputElement>>;
  notice: Nullable<string>;
  onCancel: () => void;
  onChange: (draft: CharacterAliasRow) => void;
  onConfirm: () => void;
  originalName: Nullable<string>;
  scope: CharacterEditScope;
};

const EDITOR_CONTEXT = {
  book: "editor.contextBook",
  global: "editor.contextGlobal",
} as const satisfies Record<CharacterEditScope, string>;

export function CharacterAliasEditor({
  canConfirm,
  draft,
  error,
  nameRef,
  notice,
  onCancel,
  onChange,
  onConfirm,
  originalName,
  scope,
}: CharacterAliasEditorProps) {
  const t = useTranslations("characters.aliases");
  const tType = useTranslations("characters.aliasType");
  const id = useId();
  const headingId = `${id}-heading`;
  const nameId = `${id}-name`;
  const typeId = `${id}-type`;
  const errorId = `${id}-error`;
  const noticeId = `${id}-notice`;
  const nameDescription = [notice === null ? null : noticeId, error === null ? null : errorId]
    .filter((value) => value !== null)
    .join(" ");

  useEffect(() => {
    nameRef.current?.focus();
  }, [nameRef]);

  function cancelOnEscape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onCancel();
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key !== "Enter") {
      cancelOnEscape(event);
      return;
    }
    event.preventDefault();
    onConfirm();
  }

  return (
    <div
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-secondary/30 p-4 motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in",
        notice === null ? "border-border" : "border-warning",
      )}
      role="group"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h4 className="min-w-0 text-sm font-semibold break-words text-ink" id={headingId}>
          {originalName === null
            ? t("editor.addTitle")
            : t("editor.editTitle", { name: originalName })}
        </h4>
        <span className="text-xs text-muted-foreground">{t(EDITOR_CONTEXT[scope])}</span>
      </div>

      {notice === null ? null : (
        <p
          className="flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-foreground"
          id={noticeId}
        >
          <UiIcon className="mt-0.5 text-warning" name="alert-triangle" size={16} />
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={nameId}>{t("name")}</Label>
          <Input
            aria-describedby={nameDescription === "" ? undefined : nameDescription}
            aria-invalid={error !== null}
            autoComplete="off"
            id={nameId}
            maxLength={CHARACTER_TEXT_MAX.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            onKeyDown={handleNameKeyDown}
            placeholder={t("namePlaceholder")}
            ref={nameRef}
            value={draft.name}
          />
          <FieldError error={error === null ? undefined : { message: error }} id={errorId} />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <Label htmlFor={typeId}>{t("type")}</Label>
          <Select
            onValueChange={(next) => onChange({ ...draft, type: toAliasType(next) })}
            value={draft.type}
          >
            <SelectTrigger className="w-full" id={typeId} onKeyDown={cancelOnEscape}>
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
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground select-none">
        <Checkbox
          checked={draft.isSpoiler}
          className="size-5 rounded-sm"
          onCheckedChange={(checked) => onChange({ ...draft, isSpoiler: checked === true })}
          onKeyDown={cancelOnEscape}
        />
        {t("editor.spoiler")}
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel} onKeyDown={cancelOnEscape} type="button" variant="ghost">
          {t("cancel")}
        </Button>
        <Button disabled={!canConfirm} onClick={onConfirm} onKeyDown={cancelOnEscape} type="button">
          {originalName === null ? t("confirmAdd") : t("confirmEdit")}
        </Button>
      </div>
    </div>
  );
}

function toAliasType(value: string): CharacterAliasRow["type"] {
  return ALIAS_TYPE_OPTIONS.find((option) => option === value) ?? ALIAS_DEFAULT_TYPE;
}

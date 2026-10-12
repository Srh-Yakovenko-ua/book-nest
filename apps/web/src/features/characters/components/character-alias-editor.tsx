"use client";

import type { Nullable } from "@app/shared";
import type { KeyboardEvent, RefObject } from "react";

import { CHARACTER_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { CharacterAliasRow } from "../model/character-aliases";

import { ALIAS_DEFAULT_TYPE } from "../model/character-aliases";
import { ALIAS_TYPE_OPTIONS } from "../model/character-options";

type CharacterAliasEditorProps = {
  confirmLabel: string;
  errorOf: (draft: CharacterAliasRow) => Nullable<string>;
  id: string;
  initialRow: CharacterAliasRow;
  nameRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
  onConfirm: (row: CharacterAliasRow) => void;
};

export function CharacterAliasEditor({
  confirmLabel,
  errorOf,
  id,
  initialRow,
  nameRef,
  onCancel,
  onConfirm,
}: CharacterAliasEditorProps) {
  const t = useTranslations("characters.aliases");
  const tType = useTranslations("characters.aliasType");
  const [draft, setDraft] = useState(initialRow);
  const error = errorOf(draft);
  const errorId = `${id}-error`;
  const canConfirm = draft.name.trim().length > 0 && error === null;

  useEffect(() => {
    nameRef.current?.focus();
  }, [nameRef]);

  function confirm() {
    if (!canConfirm) return;
    onConfirm({ ...draft, name: draft.name.trim() });
  }

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
    confirm();
  }

  return (
    <div className="flex min-w-0 basis-full flex-wrap items-start gap-2">
      <div className="flex min-w-0 flex-1 basis-full flex-col gap-1 sm:basis-40">
        <Input
          aria-describedby={error === null ? undefined : errorId}
          aria-invalid={error !== null}
          aria-label={t("name")}
          autoComplete="off"
          id={id}
          maxLength={CHARACTER_TEXT_MAX.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          onKeyDown={handleNameKeyDown}
          placeholder={t("namePlaceholder")}
          ref={nameRef}
          value={draft.name}
        />
        <FieldError error={error === null ? undefined : { message: error }} id={errorId} />
      </div>
      <Select
        onValueChange={(next) => setDraft({ ...draft, type: toAliasType(next) })}
        value={draft.type}
      >
        <SelectTrigger
          aria-label={t("type")}
          className="min-w-36 flex-1 sm:w-40 sm:flex-none"
          onKeyDown={cancelOnEscape}
        >
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
      <TooltipHint label={t(draft.isSpoiler ? "spoilerToggle.unmark" : "spoilerToggle.mark")}>
        <Button
          aria-label={t("spoiler")}
          aria-pressed={draft.isSpoiler}
          onClick={() => setDraft({ ...draft, isSpoiler: !draft.isSpoiler })}
          onKeyDown={cancelOnEscape}
          size="icon"
          type="button"
          variant={draft.isSpoiler ? "tonal" : "outline"}
        >
          <UiIcon name={draft.isSpoiler ? "eye-off" : "eye"} size={16} />
        </Button>
      </TooltipHint>
      <div className="ml-auto flex gap-2">
        <Button onClick={onCancel} onKeyDown={cancelOnEscape} type="button" variant="ghost">
          {t("cancel")}
        </Button>
        <Button disabled={!canConfirm} onClick={confirm} onKeyDown={cancelOnEscape} type="button">
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

function toAliasType(value: string): CharacterAliasRow["type"] {
  return ALIAS_TYPE_OPTIONS.find((option) => option === value) ?? ALIAS_DEFAULT_TYPE;
}

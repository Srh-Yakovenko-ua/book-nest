"use client";

import type { Nullable } from "@app/shared";
import type { ReactElement, RefCallback } from "react";
import type { FieldError } from "react-hook-form";

import { CHARACTER_ALIASES_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { UiIcon } from "@/components/icons";
import { FieldError as FieldErrorText } from "@/components/ui/field-error";

import type { CharacterAliasRow } from "../model/character-aliases";
import type { CharacterEditScope } from "../model/character-edit-form";

import { findAliasConflicts } from "../model/character-aliases";
import { CharacterAliasChip } from "./character-alias-chip";
import { CharacterScopeBadge } from "./character-scope-badge";

type CharacterAliasGroupProps = {
  active: Nullable<{ isSpoiler: boolean; key: string }>;
  addButtonRef: RefCallback<HTMLButtonElement>;
  chipButtonRef: (key: string) => RefCallback<HTMLButtonElement>;
  editor: Nullable<ReactElement>;
  entries: readonly { key: string; row: CharacterAliasRow }[];
  errors: (FieldError | undefined)[];
  onAdd: () => void;
  onEdit: (key: string) => void;
  onRemove: (key: string) => void;
  onToggleSpoiler: (key: string) => void;
  reservedName: string;
  scope: CharacterEditScope;
};

const ALIAS_GROUP_COPY = {
  book: { description: "bookHint", reserved: "errorSameAsDisplayName", title: "bookTitle" },
  global: { description: "globalHint", reserved: "errorSameAsName", title: "globalTitle" },
} as const satisfies Record<
  CharacterEditScope,
  Record<"description" | "reserved" | "title", string>
>;

export function CharacterAliasGroup({
  active,
  addButtonRef,
  chipButtonRef,
  editor,
  entries,
  errors,
  onAdd,
  onEdit,
  onRemove,
  onToggleSpoiler,
  reservedName,
  scope,
}: CharacterAliasGroupProps) {
  const t = useTranslations("characters.aliases");
  const id = useId();
  const copy = ALIAS_GROUP_COPY[scope];
  const atLimit = entries.length >= CHARACTER_ALIASES_MAX;
  const canAdd = editor === null && !atLimit;
  const titleId = `${id}-title`;
  const counterId = `${id}-counter`;
  const conflicts = findAliasConflicts({ aliases: entries.map(({ row }) => row), reservedName });
  const rowErrors = entries.map((_entry, index) => rowErrorOf(index));

  function rowErrorOf(index: number): Nullable<string> {
    if (conflicts.reservedIndexes.includes(index)) return t(copy.reserved);
    if (conflicts.duplicateIndexes.includes(index)) return t("errorDuplicate");
    const formError = errors[index];
    const isStaleConflict = formError?.type === "custom";
    if (formError?.message === undefined || isStaleConflict) return null;
    return formError.message;
  }

  function errorIdOf(key: string) {
    return `${id}-${key}-error`;
  }

  return (
    <div aria-labelledby={titleId} className="flex flex-col gap-2.5" role="group">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 text-sm font-semibold text-ink" id={titleId}>
            {t(copy.title)}
          </h3>
          <CharacterScopeBadge scope={scope} />
          <span
            className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
            id={counterId}
          >
            {t("counter", { count: entries.length, max: CHARACTER_ALIASES_MAX })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t(copy.description)}</p>
      </div>

      <div className="flex min-h-14 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-input bg-field p-2">
        {entries.length === 0 ? (
          <p className="px-1.5 text-sm text-muted-foreground">{t("empty")}</p>
        ) : null}
        {entries.map(({ key, row }, index) => {
          const isActive = active?.key === key;
          return (
            <CharacterAliasChip
              active={isActive}
              editButtonRef={chipButtonRef(key)}
              errorId={typeof rowErrors[index] === "string" ? errorIdOf(key) : undefined}
              key={key}
              onEdit={() => onEdit(key)}
              onRemove={() => onRemove(key)}
              onToggleSpoiler={() => onToggleSpoiler(key)}
              row={isActive ? { ...row, isSpoiler: active.isSpoiler } : row}
            />
          );
        })}
        {canAdd ? (
          <button
            aria-describedby={counterId}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-accent-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onAdd}
            ref={addButtonRef}
            type="button"
          >
            <UiIcon name="plus" size={16} />
            {t("add")}
          </button>
        ) : null}
      </div>

      {entries.map(({ key, row }, index) => {
        const message = rowErrors[index];
        if (typeof message !== "string") return null;
        return (
          <FieldErrorText
            error={{ message: t("errorOnName", { message, name: row.name }) }}
            id={errorIdOf(key)}
            key={key}
          />
        );
      })}

      {atLimit ? <p className="text-xs text-muted-foreground">{t("atMax")}</p> : null}

      {editor}
    </div>
  );
}

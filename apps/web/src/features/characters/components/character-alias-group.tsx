"use client";

import type { Nullable } from "@app/shared";
import type { RefCallback } from "react";
import type { FieldError } from "react-hook-form";

import { CHARACTER_ALIASES_MAX, normalizeName } from "@app/shared";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { UiIcon } from "@/components/icons";
import { FieldError as FieldErrorText } from "@/components/ui/field-error";

import type { CharacterAliasRow } from "../model/character-aliases";
import type { CharacterEditScope } from "../model/character-edit-form";

import {
  emptyAliasRow,
  findAliasConflicts,
  findAliasDraftConflict,
} from "../model/character-aliases";
import { CharacterAliasChip } from "./character-alias-chip";
import { CharacterAliasEditor } from "./character-alias-editor";
import { CharacterScopeBadge } from "./character-scope-badge";

type AliasEditorState =
  { index: number; mode: "edit" } | { mode: "add"; session: number } | { mode: "closed" };

type CharacterAliasGroupProps = {
  errors: (FieldError | undefined)[];
  onChange: (aliases: CharacterAliasRow[]) => void;
  reservedName: string;
  scope: CharacterEditScope;
  value: CharacterAliasRow[];
};

const ALIAS_GROUP_COPY = {
  book: { description: "bookHint", reserved: "errorSameAsDisplayName", title: "bookTitle" },
  global: { description: "globalHint", reserved: "errorSameAsName", title: "globalTitle" },
} as const satisfies Record<
  CharacterEditScope,
  Record<"description" | "reserved" | "title", string>
>;

export function CharacterAliasGroup({
  errors,
  onChange,
  reservedName,
  scope,
  value,
}: CharacterAliasGroupProps) {
  const t = useTranslations("characters.aliases");
  const id = useId();
  const [editor, setEditor] = useState<AliasEditorState>({ mode: "closed" });
  const [announcement, setAnnouncement] = useState("");
  const chipButtons = useRef(new Map<number, HTMLButtonElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editorNameRef = useRef<HTMLInputElement>(null);
  const copy = ALIAS_GROUP_COPY[scope];
  const atLimit = value.length >= CHARACTER_ALIASES_MAX;
  const titleId = `${id}-title`;
  const counterId = `${id}-counter`;
  const editorId = `${id}-editor`;
  const editingIndex = editor.mode === "edit" ? editor.index : null;
  const conflicts = findAliasConflicts({ aliases: value, reservedName });
  const rowErrors = value.map((_row, index) => rowErrorOf(index));

  function rowErrorOf(index: number): Nullable<string> {
    if (conflicts.reservedIndexes.includes(index)) return t(copy.reserved);
    if (conflicts.duplicateIndexes.includes(index)) return t("errorDuplicate");
    const formError = errors[index];
    const isStaleConflict = formError?.type === "custom";
    if (formError?.message === undefined || isStaleConflict) return null;
    return formError.message;
  }

  function errorIdOf(index: number) {
    return `${id}-alias-${index}-error`;
  }

  function chipButtonRef(index: number): RefCallback<HTMLButtonElement> {
    return (node) => {
      if (node === null) return;
      chipButtons.current.set(index, node);
      return () => {
        chipButtons.current.delete(index);
      };
    };
  }

  function focusNearestChip(index: number) {
    const chip = chipButtons.current.get(index) ?? chipButtons.current.get(index - 1);
    (chip ?? addButtonRef.current ?? editorNameRef.current)?.focus();
  }

  function draftErrorOf(draft: CharacterAliasRow): Nullable<string> {
    const conflict = findAliasDraftConflict({
      aliases: value,
      draft,
      editingIndex,
      reservedName,
    });
    switch (conflict) {
      case "duplicate":
        return t("errorDuplicate");
      case null:
        return null;
      case "reserved":
        return t(copy.reserved);
    }
  }

  function announce(
    key: "announceAdded" | "announceRemoved",
    { count, name }: { count: number; name: string },
  ) {
    setAnnouncement(t(key, { count, max: CHARACTER_ALIASES_MAX, name }));
  }

  function add(row: CharacterAliasRow) {
    const next = [...value, row];
    announce("announceAdded", { count: next.length, name: row.name });
    if (next.length < CHARACTER_ALIASES_MAX) {
      onChange(next);
      setEditor((current) =>
        current.mode === "add" ? { mode: "add", session: current.session + 1 } : current,
      );
      return;
    }
    flushSync(() => {
      onChange(next);
      setEditor({ mode: "closed" });
    });
    focusNearestChip(next.length - 1);
  }

  function replaceAt(index: number, row: CharacterAliasRow) {
    flushSync(() => {
      onChange(value.map((current, position) => (position === index ? row : current)));
      setEditor({ mode: "closed" });
    });
    focusNearestChip(index);
  }

  function cancel() {
    const closing = editor;
    flushSync(() => setEditor({ mode: "closed" }));
    if (closing.mode === "edit") {
      focusNearestChip(closing.index);
      return;
    }
    addButtonRef.current?.focus();
  }

  function removeAt(index: number) {
    const removed = value[index];
    if (removed === undefined) return;
    flushSync(() => {
      onChange(value.filter((_, position) => position !== index));
      if (editor.mode === "edit" && editor.index > index) {
        setEditor({ index: editor.index - 1, mode: "edit" });
      }
    });
    announce("announceRemoved", { count: value.length - 1, name: removed.name });
    focusNearestChip(index);
  }

  function toggleSpoilerAt(index: number) {
    onChange(
      value.map((row, position) =>
        position === index ? { ...row, isSpoiler: !row.isSpoiler } : row,
      ),
    );
  }

  return (
    <div aria-labelledby={titleId} className="flex flex-col gap-2" role="group">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 text-sm font-semibold text-ink" id={titleId}>
            {t(copy.title)}
          </h3>
          <CharacterScopeBadge scope={scope} />
        </div>
        <p className="text-xs text-muted-foreground">{t(copy.description)}</p>
      </div>

      <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-md border border-input bg-field px-2.5 py-2">
        {value.map((row, index) =>
          editingIndex === index ? (
            <CharacterAliasEditor
              confirmLabel={t("confirmEdit")}
              errorOf={draftErrorOf}
              id={editorId}
              initialRow={row}
              key={`edit-${aliasKeyOf(row)}`}
              nameRef={editorNameRef}
              onCancel={cancel}
              onConfirm={(next) => replaceAt(index, next)}
            />
          ) : (
            <CharacterAliasChip
              editButtonRef={chipButtonRef(index)}
              errorId={typeof rowErrors[index] === "string" ? errorIdOf(index) : undefined}
              key={aliasKeyOf(row)}
              onEdit={() => setEditor({ index, mode: "edit" })}
              onRemove={() => removeAt(index)}
              onToggleSpoiler={() => toggleSpoilerAt(index)}
              row={row}
            />
          ),
        )}

        {editor.mode === "add" ? (
          <CharacterAliasEditor
            confirmLabel={t("confirmAdd")}
            errorOf={draftErrorOf}
            id={editorId}
            initialRow={emptyAliasRow()}
            key={`add-${editor.session}`}
            nameRef={editorNameRef}
            onCancel={cancel}
            onConfirm={add}
          />
        ) : (
          <button
            aria-describedby={counterId}
            className="flex h-7 min-w-fit flex-1 cursor-text items-center gap-1.5 rounded-md px-1 text-left text-[0.9375rem] text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-muted-foreground"
            disabled={atLimit}
            onClick={() => setEditor({ mode: "add", session: 0 })}
            ref={addButtonRef}
            type="button"
          >
            <UiIcon name="plus" size={14} />
            {t("addPlaceholder")}
          </button>
        )}
      </div>

      {value.map((row, index) => {
        const message = rowErrors[index];
        if (typeof message !== "string") return null;
        return (
          <FieldErrorText
            error={{ message: t("errorOnName", { message, name: row.name }) }}
            id={errorIdOf(index)}
            key={aliasKeyOf(row)}
          />
        );
      })}

      <div className="flex items-start gap-3 text-xs text-muted-foreground">
        {atLimit ? <p>{t("atMax")}</p> : null}
        <span className="ml-auto shrink-0 tabular-nums" id={counterId}>
          {t("counter", { count: value.length, max: CHARACTER_ALIASES_MAX })}
        </span>
      </div>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

function aliasKeyOf(row: CharacterAliasRow): string {
  return `${row.type}:${normalizeName(row.name)}`;
}

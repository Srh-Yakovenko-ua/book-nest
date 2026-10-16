"use client";

import type { Nullable } from "@app/shared";
import type { RefCallback } from "react";
import type { Control, UseFormGetValues, UseFormSetValue } from "react-hook-form";

import { CHARACTER_ALIASES_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import { assertNever } from "@/lib/assert-never";

import type { AliasRestoreRefusal, CharacterAliasRow } from "./character-aliases";
import type { CharacterEditScope, CharacterEditValues } from "./character-edit-form";

import {
  aliasRestoreIndex,
  aliasRestoreRefusal,
  emptyAliasRow,
  findAliasDraftConflict,
  isAliasDraftChanged,
} from "./character-aliases";
import { effectiveCharacterName } from "./character-edit-form";

export type CharacterAliasesHandle = {
  expireUndo: (scope: CharacterEditScope) => void;
  revealDirtyDraft: () => boolean;
};

type AliasEditorRequest =
  | { key: string; kind: "edit"; scope: CharacterEditScope }
  | { key: string; kind: "remove"; scope: CharacterEditScope }
  | { kind: "add"; scope: CharacterEditScope };

type AliasEditorSession =
  | {
      draft: CharacterAliasRow;
      mode: "add";
      nameTouched: boolean;
      saveBlocked: boolean;
      scope: CharacterEditScope;
    }
  | {
      draft: CharacterAliasRow;
      mode: "edit";
      nameTouched: boolean;
      original: CharacterAliasRow;
      saveBlocked: boolean;
      scope: CharacterEditScope;
      targetKey: string;
    };

type AliasRemoval = {
  countBefore: number;
  index: number;
  key: string;
  previousKey: Nullable<string>;
  row: CharacterAliasRow;
  scope: CharacterEditScope;
};

type DraftIssue = "duplicate" | "limit" | "required" | "reserved";

const ALIAS_EDITOR = {
  path: { book: "book.aliases", global: "global.aliases" },
  reservedMessage: { book: "errorSameAsDisplayName", global: "errorSameAsName" },
  restoreRefusalMessage: {
    duplicate: "undo.duplicate",
    limit: "undo.limit",
    reserved: "undo.reserved",
  },
  undoToastId: "character-alias-undo",
} as const satisfies {
  path: Record<CharacterEditScope, `${CharacterEditScope}.aliases`>;
  reservedMessage: Record<CharacterEditScope, string>;
  restoreRefusalMessage: Record<AliasRestoreRefusal, string>;
  undoToastId: string;
};

export function useCharacterAliasEditor({
  control,
  getValues,
  onDraftDirtyChange,
  saving,
  setValue,
}: {
  control: Control<CharacterEditValues>;
  getValues: UseFormGetValues<CharacterEditValues>;
  onDraftDirtyChange: (dirty: boolean) => void;
  saving: boolean;
  setValue: UseFormSetValue<CharacterEditValues>;
}) {
  const t = useTranslations("characters.aliases");
  const globalRows = useWatch({ control, name: "global.aliases" });
  const bookRows = useWatch({ control, name: "book.aliases" });
  const globalName = useWatch({ control, name: "global.name" });
  const bookDisplayName = useWatch({ control, name: "book.displayName" });
  const [session, setSession] = useState<Nullable<AliasEditorSession>>(null);
  const [pendingRequest, setPendingRequest] = useState<Nullable<AliasEditorRequest>>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rowKeys, setRowKeys] = useState<Record<CharacterEditScope, string[]>>(() => ({
    book: bookRows.map((_row, index) => `book-${index}`),
    global: globalRows.map((_row, index) => `global-${index}`),
  }));
  const keySequence = useRef(0);
  const lastRemoval = useRef<Nullable<AliasRemoval>>(null);
  const restoreLatest = useRef(restore);
  const chipButtons = useRef(new Map<string, HTMLButtonElement>());
  const addButtons = useRef(new Map<CharacterEditScope, HTMLButtonElement>());
  const editorNameRef = useRef<Nullable<HTMLInputElement>>(null);
  const dialogReturnFocus = useRef<Nullable<HTMLElement>>(null);

  const rowsByScope = { book: bookRows, global: globalRows } satisfies Record<
    CharacterEditScope,
    CharacterAliasRow[]
  >;
  const reservedNames = {
    book: effectiveCharacterName({ displayName: bookDisplayName, globalName }),
    global: globalName,
  } satisfies Record<CharacterEditScope, string>;

  useEffect(() => {
    restoreLatest.current = restore;
  });

  useEffect(
    () => () => {
      lastRemoval.current = null;
    },
    [],
  );

  function keysOf(scope: CharacterEditScope, rows: readonly CharacterAliasRow[]): string[] {
    const keys = rowKeys[scope];
    if (keys.length === rows.length) return keys;
    return rows.map((_row, index) => `${scope}-unkeyed-${index}`);
  }

  function writeAliases({
    keys,
    rows,
    scope,
  }: {
    keys: string[];
    rows: CharacterAliasRow[];
    scope: CharacterEditScope;
  }) {
    setValue(ALIAS_EDITOR.path[scope], rows, { shouldDirty: true, shouldValidate: true });
    setRowKeys((current) => ({ ...current, [scope]: keys }));
  }

  function changeSession(next: Nullable<AliasEditorSession>) {
    setSession(next);
    onDraftDirtyChange(isSessionDirty(next));
  }

  function announce(
    key: "announceAdded" | "announceRemoved" | "announceRestored",
    { count, name }: { count: number; name: string },
  ) {
    setAnnouncement(t(key, { count, max: CHARACTER_ALIASES_MAX, name }));
  }

  function draftIssueOf(candidate: AliasEditorSession): Nullable<DraftIssue> {
    if (candidate.draft.name.trim() === "") return "required";
    const rows = rowsByScope[candidate.scope];
    if (candidate.mode === "add" && rows.length >= CHARACTER_ALIASES_MAX) return "limit";
    return findAliasDraftConflict({
      aliases: rows,
      draft: candidate.draft,
      editingIndex:
        candidate.mode === "edit"
          ? keysOf(candidate.scope, rows).indexOf(candidate.targetKey)
          : null,
      reservedName: reservedNames[candidate.scope],
    });
  }

  function issueMessageOf(issue: DraftIssue, scope: CharacterEditScope): string {
    switch (issue) {
      case "duplicate":
        return t("errorDuplicate");
      case "limit":
        return t("atMax");
      case "required":
        return t("editor.nameRequired");
      case "reserved":
        return t(ALIAS_EDITOR.reservedMessage[scope]);
      default:
        return assertNever(issue);
    }
  }

  function nearestFocusTarget({
    index,
    keys,
    scope,
  }: {
    index: number;
    keys: readonly string[];
    scope: CharacterEditScope;
  }): Nullable<HTMLElement> {
    const neighbourKey = keys[index + 1] ?? keys[index - 1];
    const neighbour =
      neighbourKey === undefined ? undefined : chipButtons.current.get(neighbourKey);
    return neighbour ?? addButtons.current.get(scope) ?? editorNameRef.current;
  }

  function editSessionOf(scope: CharacterEditScope, key: string): Nullable<AliasEditorSession> {
    const rows = rowsByScope[scope];
    const row = rows[keysOf(scope, rows).indexOf(key)];
    if (row === undefined) return null;
    return {
      draft: row,
      mode: "edit",
      nameTouched: false,
      original: row,
      saveBlocked: false,
      scope,
      targetKey: key,
    };
  }

  function perform(next: AliasEditorRequest) {
    switch (next.kind) {
      case "add":
        changeSession({
          draft: emptyAliasRow(),
          mode: "add",
          nameTouched: false,
          saveBlocked: false,
          scope: next.scope,
        });
        return;
      case "edit": {
        const editing = editSessionOf(next.scope, next.key);
        if (editing !== null) changeSession(editing);
        return;
      }
      case "remove":
        remove(next.scope, next.key);
        return;
      default:
        assertNever(next);
    }
  }

  function request(next: AliasEditorRequest) {
    if (!isSessionDirty(session)) {
      perform(next);
      return;
    }
    dialogReturnFocus.current = null;
    setPendingRequest(next);
  }

  function requestAdd(scope: CharacterEditScope) {
    if (session?.mode === "add" && session.scope === scope) {
      editorNameRef.current?.focus();
      return;
    }
    request({ kind: "add", scope });
  }

  function requestEdit(scope: CharacterEditScope, key: string) {
    if (session?.mode === "edit" && session.targetKey === key) {
      editorNameRef.current?.focus();
      return;
    }
    request({ key, kind: "edit", scope });
  }

  function requestRemove(scope: CharacterEditScope, key: string) {
    const removesEdited = session?.mode === "edit" && session.targetKey === key;
    if (removesEdited) {
      request({ key, kind: "remove", scope });
      return;
    }
    remove(scope, key);
  }

  function remove(scope: CharacterEditScope, key: string) {
    const rows = getValues(ALIAS_EDITOR.path[scope]);
    const keys = keysOf(scope, rows);
    const index = keys.indexOf(key);
    const row = rows[index];
    if (row === undefined) return;
    const removal: AliasRemoval = {
      countBefore: rows.length,
      index,
      key,
      previousKey: keys[index - 1] ?? null,
      row,
      scope,
    };
    flushSync(() => {
      writeAliases({
        keys: keys.filter((_key, position) => position !== index),
        rows: rows.filter((_row, position) => position !== index),
        scope,
      });
      if (session?.mode === "edit" && session.targetKey === key) changeSession(null);
    });
    lastRemoval.current = removal;
    announce("announceRemoved", { count: rows.length - 1, name: row.name });
    const focusTarget = nearestFocusTarget({ index, keys, scope });
    dialogReturnFocus.current = focusTarget;
    focusTarget?.focus();
    toast(t("undo.removed", { name: row.name }), {
      action: { label: t("undo.action"), onClick: () => restoreLatest.current(removal) },
      id: ALIAS_EDITOR.undoToastId,
    });
  }

  function restore(removal: AliasRemoval) {
    if (lastRemoval.current !== removal) {
      toast.warning(t("undo.expired"));
      return;
    }
    lastRemoval.current = null;
    if (saving) {
      toast.warning(t("undo.expired"));
      return;
    }
    const { scope } = removal;
    const rows = getValues(ALIAS_EDITOR.path[scope]);
    const refusal = aliasRestoreRefusal({
      aliases: rows,
      countBeforeRemoval: removal.countBefore,
      removed: removal.row,
      reservedName: reservedNames[scope],
    });
    if (refusal !== null) {
      toast.warning(t(ALIAS_EDITOR.restoreRefusalMessage[refusal], { name: removal.row.name }));
      return;
    }
    const keys = keysOf(scope, rows);
    const index = aliasRestoreIndex({
      keys,
      originalIndex: removal.index,
      previousKey: removal.previousKey,
    });
    flushSync(() =>
      writeAliases({
        keys: insertAt(keys, index, removal.key),
        rows: insertAt(rows, index, removal.row),
        scope,
      }),
    );
    announce("announceRestored", { count: rows.length + 1, name: removal.row.name });
    chipButtons.current.get(removal.key)?.focus();
  }

  function toggleSpoiler(scope: CharacterEditScope, key: string) {
    if (session?.mode === "edit" && session.targetKey === key) {
      changeDraft({ ...session.draft, isSpoiler: !session.draft.isSpoiler });
      return;
    }
    const rows = getValues(ALIAS_EDITOR.path[scope]);
    const keys = keysOf(scope, rows);
    writeAliases({
      keys,
      rows: rows.map((row, position) =>
        keys[position] === key ? { ...row, isSpoiler: !row.isSpoiler } : row,
      ),
      scope,
    });
  }

  function changeDraft(draft: CharacterAliasRow) {
    if (session === null) return;
    changeSession({
      ...session,
      draft,
      nameTouched: session.nameTouched || draft.name !== session.draft.name,
    });
  }

  function confirm() {
    if (session === null) return;
    if (draftIssueOf(session) !== null) {
      changeSession({ ...session, nameTouched: true });
      return;
    }
    const { scope } = session;
    const rows = getValues(ALIAS_EDITOR.path[scope]);
    const keys = keysOf(scope, rows);
    const row = { ...session.draft, name: session.draft.name.trim() };

    if (session.mode === "add") {
      keySequence.current += 1;
      const key = `${scope}-added-${keySequence.current}`;
      flushSync(() => {
        writeAliases({ keys: [...keys, key], rows: [...rows, row], scope });
        changeSession(null);
      });
      announce("announceAdded", { count: rows.length + 1, name: row.name });
      (addButtons.current.get(scope) ?? chipButtons.current.get(key))?.focus();
      return;
    }

    const { targetKey } = session;
    const index = keys.indexOf(targetKey);
    const changed = isSessionDirty(session);
    flushSync(() => {
      if (changed && index !== -1) {
        writeAliases({
          keys,
          rows: rows.map((current, position) => (position === index ? row : current)),
          scope,
        });
      }
      changeSession(null);
    });
    chipButtons.current.get(targetKey)?.focus();
  }

  function cancel() {
    if (session === null) return;
    const closing = session;
    flushSync(() => changeSession(null));
    const focusTarget =
      closing.mode === "edit"
        ? chipButtons.current.get(closing.targetKey)
        : addButtons.current.get(closing.scope);
    focusTarget?.focus();
  }

  function discardAndContinue() {
    const next = pendingRequest;
    setPendingRequest(null);
    if (next === null) return;
    changeSession(null);
    perform(next);
  }

  function returnFocusAfterDialog(event: Event) {
    event.preventDefault();
    const target = dialogReturnFocus.current ?? editorNameRef.current;
    dialogReturnFocus.current = null;
    target?.focus();
  }

  function revealDirtyDraft(): boolean {
    if (session === null || !isSessionDirty(session)) return false;
    const blocked = { ...session, nameTouched: true, saveBlocked: true };
    flushSync(() => changeSession(blocked));
    editorNameRef.current?.focus();
    return true;
  }

  function expireUndo(scope: CharacterEditScope) {
    if (lastRemoval.current?.scope === scope) lastRemoval.current = null;
  }

  function chipButtonRef(key: string): RefCallback<HTMLButtonElement> {
    return (node) => {
      if (node === null) {
        chipButtons.current.delete(key);
        return;
      }
      chipButtons.current.set(key, node);
    };
  }

  function addButtonRef(scope: CharacterEditScope): RefCallback<HTMLButtonElement> {
    return (node) => {
      if (node === null) {
        addButtons.current.delete(scope);
        return;
      }
      addButtons.current.set(scope, node);
    };
  }

  function groupOf(scope: CharacterEditScope) {
    const rows = rowsByScope[scope];
    const keys = keysOf(scope, rows);
    const editing = session?.scope === scope ? session : null;
    return {
      active:
        editing?.mode === "edit"
          ? { isSpoiler: editing.draft.isSpoiler, key: editing.targetKey }
          : null,
      addButtonRef: addButtonRef(scope),
      chipButtonRef,
      entries: rows.map((row, index) => ({ key: keys[index] ?? `${scope}-${index}`, row })),
      onAdd: () => requestAdd(scope),
      onEdit: (key: string) => requestEdit(scope, key),
      onRemove: (key: string) => requestRemove(scope, key),
      onToggleSpoiler: (key: string) => toggleSpoiler(scope, key),
      reservedName: reservedNames[scope],
    };
  }

  function editorOf(scope: CharacterEditScope) {
    if (session === null || session.scope !== scope) return null;
    const issue = draftIssueOf(session);
    const hidesIssue = issue === "required" && !session.nameTouched;
    return {
      canConfirm: issue === null,
      draft: session.draft,
      error: issue === null || hidesIssue ? null : issueMessageOf(issue, scope),
      identity: session.mode === "edit" ? session.targetKey : `${scope}-add`,
      nameRef: editorNameRef,
      notice: session.saveBlocked && isSessionDirty(session) ? t("editor.saveBlocked") : null,
      onCancel: cancel,
      onChange: changeDraft,
      onConfirm: confirm,
      originalName: session.mode === "edit" ? session.original.name : null,
      scope,
    };
  }

  return {
    announcement,
    discardDialog: {
      onCloseAutoFocus: returnFocusAfterDialog,
      onConfirm: discardAndContinue,
      onOpenChange: (open: boolean) => {
        if (!open) setPendingRequest(null);
      },
      open: pendingRequest !== null,
    },
    editorOf,
    groupOf,
    handle: { expireUndo, revealDirtyDraft } satisfies CharacterAliasesHandle,
  };
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function isSessionDirty(session: Nullable<AliasEditorSession>): boolean {
  if (session === null) return false;
  if (session.mode === "add") return session.draft.name.trim() !== "";
  return isAliasDraftChanged({ draft: session.draft, original: session.original });
}

"use client";

import type { Nullable } from "@app/shared";
import type { FocusEvent, KeyboardEvent, RefCallback } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  ManageOwnSpeciesButton,
  type OwnSpeciesChange,
  SpeciesPicker,
  type SpeciesSelection,
} from "@/features/species";
import { assertNever } from "@/lib/assert-never";

import { BookFieldPreview } from "./character-book-field-preview";
import {
  type BookFieldAction,
  BookFieldActionButton,
  BookFieldShell,
  type BookFieldSource,
  hasFocusLeftGroup,
} from "./character-book-field-shell";

type FocusTarget = "action" | "input";

type InheritedSpeciesFieldProps = {
  globalValue: Nullable<SpeciesSelection>;
  id: string;
  label: string;
  onBlur: () => void;
  onChange: (value: Nullable<SpeciesSelection>) => void;
  onSpeciesChange: (change: OwnSpeciesChange) => void;
  placeholder: string;
  ref: RefCallback<HTMLInputElement>;
  value: Nullable<SpeciesSelection>;
};

type SpeciesFieldMode = "editing" | "inherited" | "override";

const SOURCE_BY_MODE = {
  editing: "editing",
  inherited: "global",
  override: "book",
} as const satisfies Record<SpeciesFieldMode, BookFieldSource>;

export function InheritedSpeciesField({
  globalValue,
  id,
  label,
  onBlur,
  onChange,
  onSpeciesChange,
  placeholder,
  ref,
  value,
}: InheritedSpeciesFieldProps) {
  const t = useTranslations("characters.edit");
  const [isEditing, setIsEditing] = useState(false);
  const pickerInputRef = useRef<Nullable<HTMLInputElement>>(null);
  const actionRef = useRef<Nullable<HTMLButtonElement>>(null);
  const pendingFocus = useRef<Nullable<FocusTarget>>(null);
  const mode = speciesFieldMode(isEditing, value);

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === "input") pickerInputRef.current?.focus();
    else actionRef.current?.focus();
  });

  function attachPickerInput(element: Nullable<HTMLInputElement>) {
    pickerInputRef.current = element;
    ref(element);
  }

  function startEditing() {
    pendingFocus.current = "input";
    setIsEditing(true);
  }

  function cancelEditing() {
    pendingFocus.current = "action";
    setIsEditing(false);
  }

  function pickWhileEditing(selection: Nullable<SpeciesSelection>) {
    if (selection === null || selection.id === globalValue?.id) {
      cancelEditing();
      return;
    }
    setIsEditing(false);
    onChange(selection);
  }

  function resetToGlobal() {
    pendingFocus.current = "action";
    setIsEditing(false);
    onChange(null);
  }

  function runAction() {
    switch (mode) {
      case "editing":
        cancelEditing();
        return;
      case "inherited":
        startEditing();
        return;
      case "override":
        resetToGlobal();
        return;
      default:
        assertNever(mode);
    }
  }

  function cancelOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (mode !== "editing" || event.key !== "Escape" || event.defaultPrevented) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    cancelEditing();
  }

  function closeOnFocusExit(event: FocusEvent<HTMLDivElement>) {
    if (mode !== "editing") return;
    if (!hasFocusLeftGroup(event)) return;
    setIsEditing(false);
  }

  return (
    <BookFieldShell
      action={
        <BookFieldActionButton
          action={speciesFieldAction(mode, globalValue)}
          onClick={runAction}
          ref={actionRef}
        />
      }
      htmlFor={mode === "inherited" ? undefined : id}
      label={
        <>
          {label} <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </>
      }
      onBlur={closeOnFocusExit}
      onKeyDown={cancelOnEscape}
      source={SOURCE_BY_MODE[mode]}
    >
      {mode === "inherited" ? (
        <BookFieldPreview value={globalValue?.label ?? null} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <SpeciesPicker
            inputId={id}
            label={label}
            onBlur={onBlur}
            onChange={mode === "editing" ? pickWhileEditing : onChange}
            placeholder={placeholder}
            ref={attachPickerInput}
            value={mode === "editing" ? globalValue : value}
          />
          {mode === "override" ? (
            <ManageOwnSpeciesButton onSpeciesChange={onSpeciesChange} />
          ) : null}
        </div>
      )}
    </BookFieldShell>
  );
}

function speciesFieldAction(
  mode: SpeciesFieldMode,
  globalValue: Nullable<SpeciesSelection>,
): BookFieldAction {
  switch (mode) {
    case "editing":
      return "cancelEditing";
    case "inherited":
      return globalValue === null ? "specify" : "override";
    case "override":
      return "reset";
    default:
      return assertNever(mode);
  }
}

function speciesFieldMode(isEditing: boolean, value: Nullable<SpeciesSelection>): SpeciesFieldMode {
  if (value !== null) return "override";
  return isEditing ? "editing" : "inherited";
}

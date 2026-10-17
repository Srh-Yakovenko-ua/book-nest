"use client";

import type { Nullable } from "@app/shared";
import type { FocusEvent, KeyboardEvent } from "react";
import type { FieldError } from "react-hook-form";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { FieldError as FieldErrorText } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
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

type InheritedTextFieldProps = {
  error: FieldError | undefined;
  globalValue: Nullable<string>;
  id: string;
  label: string;
  maxLength: number;
  onChange: (value: null | string) => void;
  placeholder: string;
  value: Nullable<string>;
};

type TextFieldView =
  { draft: string; mode: "editing" } | { mode: "inherited" } | { mode: "override"; text: string };

export function InheritedTextField({
  error,
  globalValue,
  id,
  label,
  maxLength,
  onChange,
  placeholder,
  value,
}: InheritedTextFieldProps) {
  const t = useTranslations("characters.edit");
  const [sessionDraft, setSessionDraft] = useState<Nullable<string>>(null);
  const inputRef = useRef<Nullable<HTMLInputElement>>(null);
  const actionRef = useRef<Nullable<HTMLButtonElement>>(null);
  const pendingFocus = useRef<Nullable<FocusTarget>>(null);
  const view = textFieldView(sessionDraft, value);
  const errorId = `${id}-error`;

  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    pendingFocus.current = null;
    if (target === "input") inputRef.current?.focus();
    else actionRef.current?.focus();
  });

  function startEditing() {
    pendingFocus.current = "input";
    setSessionDraft(globalValue ?? "");
  }

  function editDraft(draft: string) {
    setSessionDraft(draft);
    const trimmed = draft.trim();
    onChange(trimmed === "" || trimmed === globalValue ? null : draft);
  }

  function cancelEditing() {
    pendingFocus.current = "action";
    setSessionDraft(null);
    onChange(null);
  }

  function finishEditing() {
    if (value === null) pendingFocus.current = "action";
    setSessionDraft(null);
  }

  function resetToGlobal() {
    pendingFocus.current = "action";
    onChange(null);
  }

  function runAction() {
    switch (view.mode) {
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
        assertNever(view);
    }
  }

  function cancelOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (view.mode !== "editing" || event.key !== "Escape" || event.defaultPrevented) return;
    if (event.nativeEvent.isComposing) return;
    event.preventDefault();
    cancelEditing();
  }

  function finishOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (view.mode !== "editing" || event.key !== "Enter") return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    finishEditing();
  }

  function finishOnFocusExit(event: FocusEvent<HTMLDivElement>) {
    if (view.mode !== "editing") return;
    if (!hasFocusLeftGroup(event)) return;
    setSessionDraft(null);
  }

  return (
    <BookFieldShell
      action={
        <BookFieldActionButton
          action={textFieldAction(view, globalValue)}
          onClick={runAction}
          ref={actionRef}
        />
      }
      htmlFor={view.mode === "inherited" ? undefined : id}
      label={
        <>
          {label} <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </>
      }
      onBlur={finishOnFocusExit}
      onKeyDown={cancelOnEscape}
      source={textFieldSource(view, value)}
    >
      {view.mode === "inherited" ? (
        <BookFieldPreview value={globalValue} />
      ) : (
        <>
          <Input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error !== undefined}
            autoComplete="off"
            className="h-10"
            id={id}
            maxLength={maxLength}
            onChange={(event) => {
              if (view.mode === "editing") editDraft(event.target.value);
              else onChange(event.target.value);
            }}
            onKeyDown={finishOnEnter}
            placeholder={placeholder}
            ref={inputRef}
            value={view.mode === "editing" ? view.draft : view.text}
          />
          <FieldErrorText error={error} id={errorId} />
        </>
      )}
    </BookFieldShell>
  );
}

function textFieldAction(view: TextFieldView, globalValue: Nullable<string>): BookFieldAction {
  switch (view.mode) {
    case "editing":
      return "cancelEditing";
    case "inherited":
      return globalValue === null ? "specify" : "override";
    case "override":
      return "reset";
    default:
      return assertNever(view);
  }
}

function textFieldSource(view: TextFieldView, value: Nullable<string>): BookFieldSource {
  if (view.mode === "inherited") return "global";
  return view.mode === "editing" && value === null ? "editing" : "book";
}

function textFieldView(sessionDraft: Nullable<string>, value: Nullable<string>): TextFieldView {
  if (sessionDraft !== null) return { draft: sessionDraft, mode: "editing" };
  if (value === null) return { mode: "inherited" };
  return { mode: "override", text: value };
}

"use client";

import type { Control, FieldError, UseFormRegister } from "react-hook-form";

import { CHARACTER_TEXT_MAX } from "@app/shared";
import { useWatch } from "react-hook-form";

import { FieldError as FieldErrorText } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/textarea";

import type { CharacterEditValues } from "../model/character-edit-form";

type LongTextFieldName =
  | "book.appearanceNotes"
  | "book.description"
  | "book.personalImpression"
  | "global.neutralDescription";

export function CharacterLongTextField({
  control,
  error,
  id,
  name,
  placeholder,
  register,
  rows,
}: {
  control: Control<CharacterEditValues>;
  error: FieldError | undefined;
  id: string;
  name: LongTextFieldName;
  placeholder: string;
  register: UseFormRegister<CharacterEditValues>;
  rows: number;
}) {
  const value = useWatch({ control, name });
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const remaining = CHARACTER_TEXT_MAX.longText - value.length;

  return (
    <>
      <Textarea
        aria-describedby={error === undefined ? counterId : `${errorId} ${counterId}`}
        aria-invalid={error !== undefined}
        id={id}
        maxLength={CHARACTER_TEXT_MAX.longText}
        placeholder={placeholder}
        rows={rows}
        {...register(name)}
      />
      <div className="flex items-center justify-between gap-2">
        <FieldErrorText error={error} id={errorId} />
        <span
          className="ml-auto text-xs text-muted-foreground tabular-nums data-[low=true]:text-destructive"
          data-low={remaining < 0}
          id={counterId}
        >
          {value.length}/{CHARACTER_TEXT_MAX.longText}
        </span>
      </div>
    </>
  );
}

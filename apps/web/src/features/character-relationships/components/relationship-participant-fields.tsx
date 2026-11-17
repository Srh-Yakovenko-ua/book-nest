"use client";

import type { Nullable } from "@app/shared";
import type { Ref } from "react";

import { ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipParticipant,
} from "../model/relationship-form-schema";

import { RelationshipParticipantChip } from "./relationship-participant-chip";
import { RelationshipParticipantPicker } from "./relationship-participant-picker";

type ParticipantSlotName = "source" | "target";

type RelationshipParticipantFieldsProps = {
  bookId: Nullable<string>;
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  focusCharacter: Nullable<RelationshipParticipant>;
  onParticipantChange: () => void;
  onSwap: () => void;
  pairErrorRef: Ref<HTMLParagraphElement>;
};

export function RelationshipParticipantFields({
  bookId,
  control,
  errors,
  focusCharacter,
  onParticipantChange,
  onSwap,
  pairErrorRef,
}: RelationshipParticipantFieldsProps) {
  const t = useTranslations("relationships.editor.participants");
  const fieldsId = useId();
  const ids = { bookFirstHint: `${fieldsId}-book-first`, pairError: `${fieldsId}-pair-error` };
  const [source, target] = useWatch({ control, name: ["source", "target"] });
  const focusId = focusCharacter?.id ?? null;
  const canSwap =
    source !== null && target !== null && source.id !== focusId && target.id !== focusId;
  const slot = {
    bookFirstHintId: ids.bookFirstHint,
    bookId,
    control,
    focusId,
    onParticipantChange,
  };
  const pairError = errors.root?.pair?.message;

  return (
    <fieldset
      aria-describedby={pairError === undefined ? undefined : ids.pairError}
      className="flex min-w-0 flex-col gap-3"
    >
      <legend className="mb-3 text-sm font-medium text-foreground">{t("legend")}</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <ParticipantCard
          {...slot}
          error={errors.source}
          excludedIds={toExcludedIds({ focusId, other: target })}
          label={t("source")}
          name="source"
        />
        <ParticipantCard
          {...slot}
          error={errors.target}
          excludedIds={toExcludedIds({ focusId, other: source })}
          label={t("target")}
          name="target"
        />
      </div>
      {pairError === undefined ? null : (
        <p
          className="text-sm text-error outline-none"
          id={ids.pairError}
          ref={pairErrorRef}
          role="alert"
          tabIndex={-1}
        >
          {pairError}
        </p>
      )}
      {bookId === null ? (
        <p className="text-xs text-muted-foreground" id={ids.bookFirstHint}>
          {t("bookFirst")}
        </p>
      ) : null}
      {canSwap ? (
        <Button
          className="self-start max-sm:min-h-11"
          onClick={onSwap}
          size="sm"
          type="button"
          variant="ghost"
        >
          <ArrowLeftRight aria-hidden />
          {t("swap")}
        </Button>
      ) : null}
    </fieldset>
  );
}

function ParticipantCard({
  bookFirstHintId,
  bookId,
  control,
  error,
  excludedIds,
  focusId,
  label,
  name,
  onParticipantChange,
}: {
  bookFirstHintId: string;
  bookId: Nullable<string>;
  control: RelationshipFormControl;
  error: RelationshipFormErrors["source"];
  excludedIds: readonly string[];
  focusId: Nullable<string>;
  label: string;
  name: ParticipantSlotName;
  onParticipantChange: () => void;
}) {
  const t = useTranslations("relationships.editor.participants");
  const inputId = `relationship-participant-${name}`;
  const errorId = `${inputId}-error`;
  const describedBy = [
    error === undefined ? null : errorId,
    bookId === null ? bookFirstHintId : null,
  ].flatMap((id) => (id === null ? [] : [id]));

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <Label htmlFor={inputId}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) =>
          field.value !== null && field.value.id === focusId ? (
            <div
              className="flex h-11 min-w-0 items-center justify-between gap-2 rounded-lg bg-muted px-3 text-sm sm:h-10"
              id={inputId}
            >
              <RelationshipParticipantChip participant={field.value} />
              <span className="shrink-0 text-xs text-muted-foreground">{t("focus")}</span>
            </div>
          ) : (
            <RelationshipParticipantPicker
              bookId={bookId}
              describedBy={describedBy.length === 0 ? undefined : describedBy.join(" ")}
              excludedIds={excludedIds}
              id={inputId}
              invalid={error !== undefined}
              onBlur={field.onBlur}
              onChange={(participant) => {
                field.onChange(participant);
                onParticipantChange();
              }}
              ref={field.ref}
              value={field.value}
            />
          )
        }
      />
      <FieldError error={error} id={errorId} />
    </div>
  );
}

function toExcludedIds({
  focusId,
  other,
}: {
  focusId: Nullable<string>;
  other: Nullable<RelationshipParticipant>;
}): string[] {
  return [focusId, other?.id ?? null].flatMap((id) => (id === null ? [] : [id]));
}

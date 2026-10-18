"use client";

import type { Nullable } from "@app/shared";

import { ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";

import type {
  RelationshipFormControl,
  RelationshipFormErrors,
  RelationshipParticipant,
} from "../model/relationship-form-schema";

import { resolveRelationshipDirectionality } from "../model/relationship-form-input";
import { RelationshipParticipantChip } from "./relationship-participant-chip";
import { RelationshipParticipantPicker } from "./relationship-participant-picker";

type ParticipantSlotName = "source" | "target";

type RelationshipParticipantFieldsProps = {
  control: RelationshipFormControl;
  errors: RelationshipFormErrors;
  focusCharacter: Nullable<RelationshipParticipant>;
  onSwap: () => void;
  rosterBookId: Nullable<string>;
};

export function RelationshipParticipantFields({
  control,
  errors,
  focusCharacter,
  onSwap,
  rosterBookId,
}: RelationshipParticipantFieldsProps) {
  const t = useTranslations("relationships.editor.participants");
  const [source, target, type, directionality] = useWatch({
    control,
    name: ["source", "target", "type", "directionality"],
  });
  const isDirected = resolveRelationshipDirectionality({ directionality, type }) === "directed";
  const focusId = focusCharacter?.id ?? null;
  const slot = { control, focusId, rosterBookId };

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-sm font-medium text-foreground">{t("legend")}</legend>
      <ParticipantSlot
        {...slot}
        error={errors.source}
        excludedIds={toExcludedIds({ focusId, other: target })}
        label={t("source")}
        name="source"
      />
      <Button className="self-start" onClick={onSwap} size="sm" type="button" variant="ghost">
        <ArrowUpDown aria-hidden />
        {t("swap")}
      </Button>
      <ParticipantSlot
        {...slot}
        error={errors.target}
        excludedIds={toExcludedIds({ focusId, other: source })}
        label={t("target")}
        name="target"
      />
      {isDirected ? <p className="text-xs text-muted-foreground">{t("directedHint")}</p> : null}
    </fieldset>
  );
}

function ParticipantSlot({
  control,
  error,
  excludedIds,
  focusId,
  label,
  name,
  rosterBookId,
}: {
  control: RelationshipFormControl;
  error: RelationshipFormErrors["source"];
  excludedIds: readonly string[];
  focusId: Nullable<string>;
  label: string;
  name: ParticipantSlotName;
  rosterBookId: Nullable<string>;
}) {
  const t = useTranslations("relationships.editor.participants");
  const inputId = `relationship-participant-${name}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) =>
          field.value !== null && field.value.id === focusId ? (
            <div
              className="flex h-10 min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 text-sm"
              id={inputId}
            >
              <RelationshipParticipantChip participant={field.value} />
              <span className="shrink-0 text-xs text-muted-foreground">{t("focus")}</span>
            </div>
          ) : (
            <RelationshipParticipantPicker
              bookId={rosterBookId}
              describedBy={error === undefined ? undefined : errorId}
              excludedIds={excludedIds}
              id={inputId}
              invalid={error !== undefined}
              onBlur={field.onBlur}
              onChange={field.onChange}
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

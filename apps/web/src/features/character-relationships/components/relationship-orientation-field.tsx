"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { TruncatedText } from "@/components/truncated-text";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import type { CreateOrientation } from "../model/relationship-create-semantics";
import type { RelationshipParticipant } from "../model/relationship-form-schema";

import {
  CREATE_ORIENTATIONS,
  toCreateOrientation,
  toEffectiveCreateEndpoints,
} from "../model/relationship-create-semantics";

type RelationshipOrientationFieldProps = {
  onOrientationChange: (orientation: CreateOrientation) => void;
  orientation: CreateOrientation;
  participantA: RelationshipParticipant;
  participantB: RelationshipParticipant;
};

export function RelationshipOrientationField({
  onOrientationChange,
  orientation,
  participantA,
  participantB,
}: RelationshipOrientationFieldProps) {
  const t = useTranslations("relationships.editor.orientation");
  const fieldId = useId();
  const legendId = `${fieldId}-legend`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm font-medium text-foreground" id={legendId}>
        {t("legend")}
      </span>
      <RadioGroup
        aria-describedby={hintId}
        aria-labelledby={legendId}
        onValueChange={(next) => {
          const parsed = toCreateOrientation(next);
          if (parsed !== null) onOrientationChange(parsed);
        }}
        value={orientation}
      >
        {CREATE_ORIENTATIONS.map((option) => {
          const { source, target } = toEffectiveCreateEndpoints({
            directionality: "directed",
            orientation: option,
            participantA,
            participantB,
          });
          const optionId = `${fieldId}-${option}`;
          return (
            <Label
              className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 font-normal sm:min-h-10"
              htmlFor={optionId}
              key={option}
            >
              <RadioGroupItem
                aria-label={t("option", { source: source.name, target: target.name })}
                id={optionId}
                value={option}
              />
              <span aria-hidden className="flex min-w-0 flex-1 items-center gap-2">
                <TruncatedText text={source.name} />
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                <TruncatedText text={target.name} />
              </span>
            </Label>
          );
        })}
      </RadioGroup>
      <p className="text-xs text-muted-foreground" id={hintId}>
        {t("hint")}
      </p>
    </div>
  );
}

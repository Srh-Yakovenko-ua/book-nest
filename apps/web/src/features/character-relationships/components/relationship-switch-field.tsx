"use client";

import { Controller } from "react-hook-form";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import type { RelationshipFormControl } from "../model/relationship-form-schema";

type RelationshipSwitchFieldName =
  | "bookState.hideRelationshipAsSpoiler"
  | "bookState.isDescriptionSpoiler"
  | "bookState.isTypeSpoiler"
  | "isCanonical";

type RelationshipSwitchFieldProps = {
  control: RelationshipFormControl;
  description: string;
  error?: { message?: string };
  id: string;
  label: string;
  name: RelationshipSwitchFieldName;
};

export function RelationshipSwitchField({
  control,
  description,
  error,
  id,
  label,
  name,
}: RelationshipSwitchFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const hasError = (error?.message ?? "") !== "";

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="cursor-pointer" htmlFor={id}>
          {label}
        </Label>
        <p className="text-xs text-muted-foreground" id={descriptionId}>
          {description}
        </p>
        <FieldError error={error} id={errorId} />
      </div>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            aria-describedby={hasError ? `${descriptionId} ${errorId}` : descriptionId}
            aria-invalid={hasError ? true : undefined}
            checked={field.value}
            className="mt-0.5"
            id={id}
            onBlur={field.onBlur}
            onCheckedChange={field.onChange}
            ref={field.ref}
          />
        )}
      />
    </div>
  );
}

"use client";

import type { NoteEntityType, NoteView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { assertNever } from "@/lib/assert-never";

import type { NoteEntityRef } from "../model/note-entity";
import type { NoteFormControl, NoteFormErrors, NoteFormRegister } from "../model/note-form-schema";

import {
  BookNoteLinkedEntity,
  BookNoteLocationFields,
  BookNotePickerField,
} from "./book-note-form-adapter";
import { NOTE_FORM_FIELD_IDS } from "./note-form-field-ids";
import {
  SeriesNoteLinkedEntity,
  SeriesNotePickerField,
  SeriesNoteSavedLocationField,
} from "./series-note-form-adapter";

type NoteEntitySlotProps = {
  control: NoteFormControl;
  entityType: NoteEntityType;
  errors: NoteFormErrors;
  linkedEntity: Nullable<NoteEntityRef>;
};

type NoteLocationSlotProps = {
  control: NoteFormControl;
  entityType: NoteEntityType;
  errors: NoteFormErrors;
  note: NoteView | undefined;
  register: NoteFormRegister;
};

export function NoteEntitySlot({ control, entityType, errors, linkedEntity }: NoteEntitySlotProps) {
  const t = useTranslations("notes.form");
  const error = errors.entity;

  if (linkedEntity !== null) {
    return (
      <div
        aria-labelledby={NOTE_FORM_FIELD_IDS.entityLabel}
        className="flex flex-col gap-2"
        role="group"
      >
        <Label id={NOTE_FORM_FIELD_IDS.entityLabel}>{t(`entityLabel.${linkedEntity.type}`)}</Label>
        <NoteLinkedEntity entity={linkedEntity} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label id={NOTE_FORM_FIELD_IDS.entityLabel}>
        {t(`entityLabel.${entityType}`)}{" "}
        <span aria-hidden className="text-destructive">
          *
        </span>
      </Label>
      <NotePickerField control={control} entityType={entityType} error={error} />
      <FieldError error={error} id={NOTE_FORM_FIELD_IDS.entityError} />
    </div>
  );
}

export function NoteLocationSlot({
  control,
  entityType,
  errors,
  note,
  register,
}: NoteLocationSlotProps) {
  switch (entityType) {
    case "book":
      return <BookNoteLocationFields control={control} errors={errors} register={register} />;
    case "series":
      return note === undefined ? null : (
        <SeriesNoteSavedLocationField control={control} location={note} />
      );
    default:
      return assertNever(entityType);
  }
}

function NoteLinkedEntity({ entity }: { entity: NoteEntityRef }) {
  switch (entity.type) {
    case "book":
      return <BookNoteLinkedEntity book={entity.book} />;
    case "series":
      return <SeriesNoteLinkedEntity series={entity.series} />;
    default:
      return assertNever(entity);
  }
}

function NotePickerField({
  control,
  entityType,
  error,
}: {
  control: NoteFormControl;
  entityType: NoteEntityType;
  error: NoteFormErrors["entity"];
}) {
  switch (entityType) {
    case "book":
      return <BookNotePickerField control={control} error={error} />;
    case "series":
      return <SeriesNotePickerField control={control} error={error} />;
    default:
      return assertNever(entityType);
  }
}

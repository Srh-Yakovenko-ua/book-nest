"use client";

import type { NoteEntityType, NoteView } from "@app/shared";

import { NOTE_INPUT_LIMITS } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { NoteEntityRef } from "../model/note-entity";
import type { NoteFormInput, NoteFormValues } from "../model/note-form-schema";

import { useCreateNote } from "../api/use-create-note";
import { useUpdateNote } from "../api/use-update-note";
import {
  buildNoteFormSchema,
  noteCreateRequest,
  noteFormDefaults,
  noteUpdateInput,
} from "../model/note-form-schema";
import { NOTE_FORM_FIELD_IDS } from "./note-form-field-ids";
import { NoteCategoryFields, NoteFlagFields, NoteTextField } from "./note-form-fields";
import { NoteEntitySlot, NoteLocationSlot } from "./note-form-slots";

type NoteFormDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  target: NoteFormTarget;
};

type NoteFormTarget =
  | { entity: NoteEntityRef; mode: "edit"; note: NoteView }
  | { entity: NoteEntityRef; mode: "preselected" }
  | { entityType: NoteEntityType; mode: "pick" };

export function NoteFormDialog({ onOpenChange, open, target }: NoteFormDialogProps) {
  const t = useTranslations("notes.form");
  const isEdit = target.mode === "edit";
  const contentRef = useRef<HTMLDivElement>(null);
  const firstFieldId =
    target.mode === "pick" ? NOTE_FORM_FIELD_IDS.entity : NOTE_FORM_FIELD_IDS.text;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>(`#${firstFieldId}`)?.focus();
        }}
        ref={contentRef}
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        <NoteForm onDone={() => onOpenChange(false)} target={target} />
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({ onDone, target }: { onDone: () => void; target: NoteFormTarget }) {
  const t = useTranslations("notes.form");
  const tErrors = useTranslations("notes.errors");
  const tToast = useTranslations("notes.toast");
  const createNote = useCreateNote();
  const updateNote = useUpdateNote({ refresh: "background" });

  const note = target.mode === "edit" ? target.note : undefined;
  const entityType = target.mode === "pick" ? target.entityType : target.entity.type;

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<NoteFormInput, unknown, NoteFormValues>({
    defaultValues: noteFormDefaults({
      entity: target.mode === "pick" ? null : target.entity,
      note,
    }),
    mode: "onTouched",
    resolver: zodResolver(
      buildNoteFormSchema({
        chapterTooLong: tErrors("chapterTooLong"),
        customCategoryTooLong: tErrors("customCategoryTooLong", {
          max: NOTE_INPUT_LIMITS.customCategoryMax,
        }),
        entityRequired: tErrors(`entityRequired.${entityType}`),
        pageNotPositive: tErrors("pageNotPositive"),
        textEmpty: tErrors("textEmpty"),
        textTooLong: tErrors("textTooLong", { max: NOTE_INPUT_LIMITS.textMax }),
      }),
    ),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (note === undefined) {
        await createNote.mutateAsync(noteCreateRequest(values));
        toast.success(tToast("created"));
      } else {
        await updateNote.mutateAsync({
          input: noteUpdateInput(entityType, values),
          noteId: note.id,
        });
        toast.success(tToast("updated"));
      }
      onDone();
    } catch {
      toast.error(tToast(note === undefined ? "createError" : "updateError"));
    }
  });

  return (
    <form className="flex min-h-0 flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="-mx-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-1 py-0.5">
        <NoteEntitySlot
          control={control}
          entityType={entityType}
          errors={errors}
          linkedEntity={target.mode === "edit" ? target.entity : null}
        />
        <NoteTextField control={control} errors={errors} register={register} />
        <NoteCategoryFields control={control} errors={errors} register={register} />
        <NoteLocationSlot
          control={control}
          entityType={entityType}
          errors={errors}
          note={note}
          register={register}
        />
        <NoteFlagFields control={control} />
      </div>

      <DialogFooter className="shrink-0">
        <Button disabled={isSubmitting} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isSubmitting} loading={isSubmitting} type="submit">
          {note === undefined ? t("submitCreate") : t("submitEdit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

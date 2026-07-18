"use client";

import type { NoteView } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { NoteEntityRef } from "../model/note-entity";
import type { NoteFormValues } from "../model/note-form-schema";

import { useCreateNote } from "../api/use-create-note";
import { useUpdateNote } from "../api/use-update-note";
import { NOTE_CATEGORY_OPTIONS, NOTE_CUSTOM_CATEGORY } from "../model/note-categories";
import {
  buildNoteFormSchema,
  NOTE_CHAPTER_MAX,
  NOTE_CUSTOM_CATEGORY_MAX,
  NOTE_TEXT_MAX,
  noteFormValuesToInput,
} from "../model/note-form-schema";
import { NoteEntityPreview } from "./note-entity-preview";

type NoteFormDialogProps = {
  entity: NoteEntityRef;
  note?: NoteView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function NoteFormDialog({ entity, note, onOpenChange, open }: NoteFormDialogProps) {
  const t = useTranslations("notes.form");
  const isEdit = note !== undefined;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        {open ? <NoteForm entity={entity} note={note} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({
  entity,
  note,
  onDone,
}: {
  entity: NoteEntityRef;
  note?: NoteView;
  onDone: () => void;
}) {
  const t = useTranslations("notes.form");
  const tCategories = useTranslations("notes.categories");
  const tErrors = useTranslations("notes.errors");
  const tToast = useTranslations("notes.toast");
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<NoteFormValues>({
    defaultValues: {
      category: note?.category ?? undefined,
      chapter: note?.chapter ?? "",
      customCategory: note?.customCategory ?? "",
      isFavorite: note?.isFavorite ?? false,
      isPinned: note?.isPinned ?? false,
      isSpoiler: note?.isSpoiler ?? false,
      page: note?.page ?? undefined,
      text: note?.text ?? "",
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildNoteFormSchema({
        chapterTooLong: tErrors("chapterTooLong"),
        customCategoryTooLong: tErrors("customCategoryTooLong", { max: NOTE_CUSTOM_CATEGORY_MAX }),
        pageNotPositive: tErrors("pageNotPositive"),
        textEmpty: tErrors("textEmpty"),
        textTooLong: tErrors("textTooLong", { max: NOTE_TEXT_MAX }),
      }),
    ),
  });

  const text = useWatch({ control, name: "text" });
  const category = useWatch({ control, name: "category" });
  const isPending = createNote.isPending || updateNote.isPending;

  const onSubmit = handleSubmit((values) => {
    const input = noteFormValuesToInput(values);

    if (note !== undefined) {
      updateNote.mutate(
        { input, noteId: note.id },
        {
          onError: () => toast.error(tToast("updateError")),
          onSuccess: () => {
            toast.success(tToast("updated"));
            onDone();
          },
        },
      );
      return;
    }

    createNote.mutate(
      { entity, input },
      {
        onError: () => toast.error(tToast("createError")),
        onSuccess: () => {
          toast.success(tToast("created"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={onSubmit}>
      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-0.5 py-0.5">
        <NoteEntityPreview entity={entity} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="note-text">
            {t("text")}{" "}
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          </Label>
          <Textarea
            aria-describedby={
              errors.text ? "note-text-error note-text-counter" : "note-text-counter"
            }
            aria-invalid={errors.text !== undefined}
            className="min-h-32"
            id="note-text"
            maxLength={NOTE_TEXT_MAX}
            placeholder={t("textPlaceholder")}
            {...register("text")}
          />
          <div className="flex items-center justify-between gap-2">
            <FieldError error={errors.text} id="note-text-error" />
            <span
              className="ml-auto text-xs text-muted-foreground tabular-nums"
              id="note-text-counter"
            >
              {text.length} / {NOTE_TEXT_MAX}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="flex-wrap" htmlFor="note-category">
            {t("category")}{" "}
            <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
          </Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <SelectTrigger
                  className="h-10 w-full data-[size=default]:h-10"
                  clearLabel={t("categoryClear")}
                  id="note-category"
                  isClearable={field.value !== undefined}
                  onClear={() => field.onChange(undefined)}
                >
                  <SelectValue placeholder={t("categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tCategories(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {category === NOTE_CUSTOM_CATEGORY ? (
          <div className="flex flex-col gap-2">
            <Label className="flex-wrap" htmlFor="note-custom-category">
              {t("customCategory")}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              aria-describedby={errors.customCategory ? "note-custom-category-error" : undefined}
              aria-invalid={errors.customCategory !== undefined}
              autoComplete="off"
              className="h-10"
              id="note-custom-category"
              maxLength={NOTE_CUSTOM_CATEGORY_MAX}
              placeholder={t("customCategoryPlaceholder")}
              {...register("customCategory")}
            />
            <FieldError error={errors.customCategory} id="note-custom-category-error" />
          </div>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Label className="flex-wrap" htmlFor="note-chapter">
              {t("chapter")}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Input
              aria-describedby={errors.chapter ? "note-chapter-error" : undefined}
              aria-invalid={errors.chapter !== undefined}
              autoComplete="off"
              className="h-10"
              id="note-chapter"
              maxLength={NOTE_CHAPTER_MAX}
              placeholder={
                entity.type === "series" ? t("chapterPlaceholderSeries") : t("chapterPlaceholder")
              }
              {...register("chapter")}
            />
            <FieldError error={errors.chapter} id="note-chapter-error" />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:w-44">
            <Label className="flex-wrap" htmlFor="note-page">
              {t("page")}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
            </Label>
            <Controller
              control={control}
              name="page"
              render={({ field }) => (
                <Input
                  aria-describedby={errors.page ? "note-page-error" : undefined}
                  aria-invalid={errors.page !== undefined}
                  autoComplete="off"
                  className="h-10"
                  id="note-page"
                  inputMode="numeric"
                  min={1}
                  onChange={(event) =>
                    field.onChange(
                      event.target.value === "" ? undefined : Number(event.target.value),
                    )
                  }
                  onKeyDown={blockNegativeNumberKeys}
                  onPaste={blockNegativeNumberPaste}
                  placeholder={t("pagePlaceholder")}
                  step={1}
                  type="number"
                  value={field.value ?? ""}
                />
              )}
            />
            <FieldError error={errors.page} id="note-page-error" />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-border p-3">
          <Controller
            control={control}
            name="isSpoiler"
            render={({ field }) => (
              <SwitchRow
                checked={field.value}
                description={t("spoilerHelp")}
                id="note-spoiler"
                label={t("spoiler")}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="isFavorite"
            render={({ field }) => (
              <SwitchRow
                checked={field.value}
                description={t("favoriteHelp")}
                id="note-favorite"
                label={t("favorite")}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="isPinned"
            render={({ field }) => (
              <SwitchRow
                checked={field.value}
                description={t("pinnedHelp")}
                id="note-pinned"
                label={t("pinned")}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      </div>

      <DialogFooter>
        <Button disabled={isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {note === undefined ? t("submitCreate") : t("submitEdit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SwitchRow({
  checked,
  description,
  id,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <Label className="cursor-pointer" htmlFor={id}>
          {label}
        </Label>
        <p className="text-xs text-muted-foreground" id={`${id}-help`}>
          {description}
        </p>
      </div>
      <Switch
        aria-describedby={`${id}-help`}
        checked={checked}
        id={id}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

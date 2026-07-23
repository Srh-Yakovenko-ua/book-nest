"use client";

import type { ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/api-errors";

import type { CharacterFormValues } from "../model/character-form-schema";

import { useCharacterDetails } from "../api/use-character-details";
import { useCreateCharacterInBook } from "../api/use-create-character-in-book";
import { useUpdateBookCharacter } from "../api/use-update-book-character";
import { useUpdateCharacter } from "../api/use-update-character";
import {
  buildCharacterFormSchema,
  CHARACTER_NAME_MAX,
  characterToFormValues,
  emptyCharacterFormValues,
  toBookProfileInput,
  toCharacterInput,
  toUpdateBookCharacter,
  toUpdateCharacter,
} from "../model/character-form-schema";
import {
  ATTITUDE_OPTIONS,
  ENTITY_KIND_OPTIONS,
  GENDER_CUSTOM,
  GENDER_OPTIONS,
  IMPORTANCE_OPTIONS,
  NARRATOR_TYPE_OPTIONS,
  STATUS_CUSTOM,
  STATUS_OPTIONS,
} from "../model/character-options";
import { ALL_REVEAL_FIELD_KEYS } from "../model/character-spoiler";
import { CharacterAliasEditor } from "./character-alias-editor";
import { CharacterImageField } from "./character-image-field";
import { CharacterRolePicker } from "./character-role-picker";
import { ExistingCharacterPicker } from "./existing-character-picker";

type CharacterFormDialogProps = {
  bookId: string;
  characterId?: string;
  initialName?: string;
  onLinkExisting: (characterId: string) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type FormControl = ReturnType<typeof useForm<CharacterFormValues>>["control"];

export function CharacterFormDialog({
  bookId,
  characterId,
  initialName,
  onLinkExisting,
  onOpenChange,
  open,
}: CharacterFormDialogProps) {
  const t = useTranslations("characters.form");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const isEdit = characterId !== undefined;

  function close() {
    setDirty(false);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (!dirty) {
      close();
      return;
    }
    setDiscardOpen(true);
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>
            {isEdit ? t("editDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>

        {open && isEdit ? (
          <EditFormLoader
            bookId={bookId}
            characterId={characterId}
            onDirtyChange={setDirty}
            onDone={close}
          />
        ) : null}

        {open && !isEdit ? (
          <CreateFlow
            bookId={bookId}
            initialName={initialName}
            onDirtyChange={setDirty}
            onDone={close}
            onLinkExisting={onLinkExisting}
          />
        ) : null}

        <DiscardDialog
          onConfirm={() => {
            setDiscardOpen(false);
            close();
          }}
          onOpenChange={setDiscardOpen}
          open={discardOpen}
        />
      </DialogContent>
    </Dialog>
  );
}

function AttitudeField({
  control,
  label,
  name,
}: {
  control: FormControl;
  label: string;
  name: "attitude" | "globalAttitude";
}) {
  const t = useTranslations("characters.form");
  const tAttitude = useTranslations("characters.attitude");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`character-${name}`}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select onValueChange={(next) => field.onChange(next)} value={field.value}>
            <SelectTrigger
              className="w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              id={`character-${name}`}
              isClearable={field.value !== ""}
              onClear={() => field.onChange("")}
            >
              <SelectValue placeholder={t("optional")} />
            </SelectTrigger>
            <SelectContent>
              {ATTITUDE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tAttitude(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function CharacterForm({
  bookId,
  characterId,
  defaultValues,
  mode,
  onDirtyChange,
  onDone,
}: {
  bookId: string;
  characterId?: string;
  defaultValues: CharacterFormValues;
  mode: "create" | "edit";
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations("characters.form");
  const tErrors = useTranslations("characters.form.errors");
  const tToast = useTranslations("characters.toast");
  const tEntity = useTranslations("characters.entityKind");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const createInBook = useCreateCharacterInBook();
  const updateCharacter = useUpdateCharacter();
  const updateBookCharacter = useUpdateBookCharacter();

  const form = useForm<CharacterFormValues>({
    defaultValues,
    mode: "onTouched",
    resolver: zodResolver(
      buildCharacterFormSchema({
        customGenderRequired: tErrors("customGenderRequired"),
        nameRequired: tErrors("nameRequired"),
        nameTooLong: tErrors("nameTooLong", { max: CHARACTER_NAME_MAX }),
      }),
    ),
  });

  const {
    control,
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = form;

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);

  const gender = useWatch({ control, name: "gender" });
  const status = useWatch({ control, name: "status" });
  const isPov = useWatch({ control, name: "isPovCharacter" });
  const isPending =
    createInBook.isPending || updateCharacter.isPending || updateBookCharacter.isPending;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (mode === "edit" && characterId !== undefined) {
        await updateCharacter.mutateAsync({ characterId, input: toUpdateCharacter(values) });
        await updateBookCharacter.mutateAsync({
          bookId,
          characterId,
          input: toUpdateBookCharacter(values),
        });
        toast.success(tToast("updated"));
        onDone();
        return;
      }

      await createInBook.mutateAsync({
        bookId,
        input: {
          bookProfile: toBookProfileInput(values),
          character: toCharacterInput(values, bookId),
          mode: "new",
        },
      });
      toast.success(tToast("created"));
      onDone();
    } catch (error) {
      if (!applyFieldErrors(form, error)) toast.error(tErrors("generic"));
    }
  });

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={onSubmit}>
      <section className="flex flex-col gap-4">
        <SectionHeading>{t("generalSection")}</SectionHeading>
        <p className="text-xs text-muted-foreground">{t("generalHint")}</p>

        <LabeledField htmlFor="character-name" label={t("name")} required>
          <Input
            aria-describedby={errors.name ? "character-name-error" : undefined}
            aria-invalid={errors.name !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-name"
            maxLength={CHARACTER_NAME_MAX}
            placeholder={t("namePlaceholder")}
            {...register("name")}
          />
          <FieldError error={errors.name} id="character-name-error" />
        </LabeledField>

        <Controller
          control={control}
          name="avatarMediaId"
          render={({ field }) => (
            <CharacterImageField
              fallbackText={defaultValues.name}
              initialPreviewUrl={undefined}
              label={t("avatar")}
              onChange={field.onChange}
              removeLabel={t("removeAvatar")}
              uploadLabel={t("uploadAvatar")}
              value={field.value}
            />
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelectField control={control} label={t("entityKind")} name="entityKind">
            {ENTITY_KIND_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {tEntity(option)}
              </SelectItem>
            ))}
          </EnumSelectField>

          <GenderField control={control} />
        </div>

        {gender === GENDER_CUSTOM ? (
          <LabeledField htmlFor="character-custom-gender" label={t("customGender")}>
            <Input
              aria-describedby={errors.customGender ? "character-custom-gender-error" : undefined}
              aria-invalid={errors.customGender !== undefined}
              className="h-10"
              id="character-custom-gender"
              {...register("customGender")}
            />
            <FieldError error={errors.customGender} id="character-custom-gender-error" />
          </LabeledField>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField htmlFor="character-species" label={t("species")} optional>
            <Input className="h-10" id="character-species" {...register("species")} />
          </LabeledField>
          <LabeledField htmlFor="character-pronouns" label={t("pronouns")} optional>
            <Input className="h-10" id="character-pronouns" {...register("pronouns")} />
          </LabeledField>
        </div>

        <LabeledField
          htmlFor="character-neutral-description"
          label={t("neutralDescription")}
          optional
        >
          <Textarea
            className="min-h-24"
            id="character-neutral-description"
            {...register("neutralDescription")}
          />
        </LabeledField>

        <AttitudeField control={control} label={t("globalAttitude")} name="globalAttitude" />

        <SwitchRow control={control} label={t("favorite")} name="isFavorite" />

        <FieldGroup label={t("aliases")}>
          <Controller
            control={control}
            name="aliases"
            render={({ field }) => (
              <CharacterAliasEditor onChange={field.onChange} value={field.value} />
            )}
          />
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-5">
        <SectionHeading>{t("bookSection")}</SectionHeading>

        <LabeledField htmlFor="character-display-name" label={t("displayName")} optional>
          <Input className="h-10" id="character-display-name" {...register("displayName")} />
        </LabeledField>

        <div className="grid gap-4 sm:grid-cols-2">
          <EnumSelectField control={control} label={t("importance")} name="importance">
            {IMPORTANCE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {tImportance(option)}
              </SelectItem>
            ))}
          </EnumSelectField>

          <EnumSelectField control={control} label={t("status")} name="status">
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {tStatus(option)}
              </SelectItem>
            ))}
          </EnumSelectField>
        </div>

        {status === STATUS_CUSTOM ? (
          <LabeledField htmlFor="character-status-custom" label={t("statusCustom")} optional>
            <Input
              className="h-10"
              id="character-status-custom"
              {...register("statusCustomText")}
            />
          </LabeledField>
        ) : null}

        <FieldGroup label={t("roles")}>
          <Controller
            control={control}
            name="roles"
            render={({ field }) => (
              <CharacterRolePicker onChange={field.onChange} value={field.value} />
            )}
          />
        </FieldGroup>

        <LabeledField htmlFor="character-book-description" label={t("bookDescription")} optional>
          <Textarea
            className="min-h-24"
            id="character-book-description"
            {...register("description")}
          />
        </LabeledField>

        <LabeledField htmlFor="character-impression" label={t("personalImpression")} optional>
          <Textarea
            className="min-h-24"
            id="character-impression"
            {...register("personalImpression")}
          />
        </LabeledField>

        <LabeledField htmlFor="character-appearance-notes" label={t("appearanceNotes")} optional>
          <Textarea
            className="min-h-24"
            id="character-appearance-notes"
            {...register("appearanceNotes")}
          />
        </LabeledField>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField htmlFor="character-species-override" label={t("speciesOverride")} optional>
            <Input
              className="h-10"
              id="character-species-override"
              {...register("speciesOverride")}
            />
          </LabeledField>
          <AttitudeField control={control} label={t("attitude")} name="attitude" />
        </div>

        <SwitchRow
          control={control}
          description={t("povHelp")}
          label={t("pov")}
          name="isPovCharacter"
        />

        {isPov ? <NarratorField control={control} label={t("narratorType")} /> : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <LabeledField
            htmlFor="character-first-chapter"
            label={t("firstAppearanceChapter")}
            optional
          >
            <Input
              className="h-10"
              id="character-first-chapter"
              {...register("firstAppearanceChapter")}
            />
          </LabeledField>
          <LabeledField htmlFor="character-first-page" label={t("firstAppearancePage")} optional>
            <Input
              className="h-10"
              id="character-first-page"
              inputMode="numeric"
              type="number"
              {...register("firstAppearancePage")}
            />
          </LabeledField>
          <LabeledField htmlFor="character-first-note" label={t("firstAppearanceNote")} optional>
            <Input
              className="h-10"
              id="character-first-note"
              {...register("firstAppearanceNote")}
            />
          </LabeledField>
        </div>

        <Controller
          control={control}
          name="portraitMediaId"
          render={({ field }) => (
            <CharacterImageField
              fallbackText={
                defaultValues.displayName.length > 0
                  ? defaultValues.displayName
                  : defaultValues.name
              }
              initialPreviewUrl={undefined}
              label={t("portrait")}
              onChange={field.onChange}
              removeLabel={t("removePortrait")}
              uploadLabel={t("uploadAvatar")}
              value={field.value}
            />
          )}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-5">
        <SectionHeading>{t("spoilerSection")}</SectionHeading>
        <SwitchRow
          control={control}
          description={t("hidePresenceHelp")}
          label={t("hidePresence")}
          name="hidePresenceAsSpoiler"
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <SpoilerToggle control={control} label={t("displayName")} name="displayNameIsSpoiler" />
          <SpoilerToggle control={control} label={t("status")} name="statusIsSpoiler" />
          <SpoilerToggle
            control={control}
            label={t("bookDescription")}
            name="descriptionIsSpoiler"
          />
          <SpoilerToggle
            control={control}
            label={t("personalImpression")}
            name="personalImpressionIsSpoiler"
          />
          <SpoilerToggle
            control={control}
            label={t("appearanceNotes")}
            name="appearanceNotesIsSpoiler"
          />
          <SpoilerToggle
            control={control}
            label={t("speciesOverride")}
            name="speciesOverrideIsSpoiler"
          />
          <SpoilerToggle control={control} label={t("portrait")} name="portraitIsSpoiler" />
        </div>
      </section>

      <DialogFooter>
        <Button disabled={isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={isPending} loading={isPending} type="submit">
          {mode === "edit" ? t("submitEdit") : t("submitCreate")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CreateFlow({
  bookId,
  initialName,
  onDirtyChange,
  onDone,
  onLinkExisting,
}: {
  bookId: string;
  initialName?: string;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
  onLinkExisting: (characterId: string) => void;
}) {
  const [step, setStep] = useState<"form" | "pick">(initialName === undefined ? "pick" : "form");

  if (step === "pick") {
    return (
      <ExistingCharacterPicker
        bookId={bookId}
        onCreateNew={() => setStep("form")}
        onPick={onLinkExisting}
      />
    );
  }

  return (
    <CharacterForm
      bookId={bookId}
      defaultValues={emptyCharacterFormValues({ name: initialName })}
      mode="create"
      onDirtyChange={onDirtyChange}
      onDone={onDone}
    />
  );
}

function DiscardDialog({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const t = useTranslations("characters.form");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("discardTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("discardDescription")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("discardCancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {t("discardConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditFormLoader({
  bookId,
  characterId,
  onDirtyChange,
  onDone,
}: {
  bookId: string;
  characterId: string;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
}) {
  const details = useCharacterDetails({
    characterId,
    contextBookId: bookId,
    revealFieldIds: ALL_REVEAL_FIELD_KEYS,
  });

  if (details.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (details.isError) return null;

  return (
    <CharacterForm
      bookId={bookId}
      characterId={characterId}
      defaultValues={characterToFormValues(details.data, bookId)}
      mode="edit"
      onDirtyChange={onDirtyChange}
      onDone={onDone}
    />
  );
}

function EnumSelectField({
  children,
  control,
  label,
  name,
}: {
  children: ReactNode;
  control: FormControl;
  label: string;
  name: "entityKind" | "importance" | "status";
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`character-${name}`}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="w-full data-[size=default]:h-10" id={`character-${name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{children}</SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function FieldGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </div>
  );
}

function GenderField({ control }: { control: FormControl }) {
  const t = useTranslations("characters.form");
  const tGender = useTranslations("characters.gender");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="character-gender">{t("gender")}</Label>
      <Controller
        control={control}
        name="gender"
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger className="w-full data-[size=default]:h-10" id="character-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENDER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tGender(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function LabeledField({
  children,
  htmlFor,
  label,
  optional = false,
  required = false,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  const t = useTranslations("characters.form");
  return (
    <div className="flex flex-col gap-2">
      <Label className="flex-wrap" htmlFor={htmlFor}>
        {label}{" "}
        {required ? (
          <span aria-hidden className="text-destructive">
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

function NarratorField({ control, label }: { control: FormControl; label: string }) {
  const t = useTranslations("characters.form");
  const tNarrator = useTranslations("characters.narratorType");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="character-narrator">{label}</Label>
      <Controller
        control={control}
        name="narratorType"
        render={({ field }) => (
          <Select onValueChange={(next) => field.onChange(next)} value={field.value}>
            <SelectTrigger
              className="w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              id="character-narrator"
              isClearable={field.value !== ""}
              onClear={() => field.onChange("")}
            >
              <SelectValue placeholder={t("optional")} />
            </SelectTrigger>
            <SelectContent>
              {NARRATOR_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {tNarrator(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return <h3 className="font-heading text-lg text-ink">{children}</h3>;
}

function SpoilerToggle({
  control,
  label,
  name,
}: {
  control: FormControl;
  label: string;
  name:
    | "appearanceNotesIsSpoiler"
    | "descriptionIsSpoiler"
    | "displayNameIsSpoiler"
    | "personalImpressionIsSpoiler"
    | "portraitIsSpoiler"
    | "speciesOverrideIsSpoiler"
    | "statusIsSpoiler";
}) {
  const t = useTranslations("characters.form");
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
          <span className="text-sm text-foreground">{label}</span>
          <Switch
            aria-label={t("spoilerToggle")}
            checked={field.value}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}

function SwitchRow({
  control,
  description,
  label,
  name,
}: {
  control: FormControl;
  description?: string;
  label: string;
  name: "hidePresenceAsSpoiler" | "isFavorite" | "isPovCharacter";
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <Label className="cursor-pointer" htmlFor={`character-${name}`}>
              {label}
            </Label>
            {description === undefined ? null : (
              <p className="text-xs text-muted-foreground" id={`character-${name}-help`}>
                {description}
              </p>
            )}
          </div>
          <Switch
            aria-describedby={description === undefined ? undefined : `character-${name}-help`}
            checked={field.value}
            id={`character-${name}`}
            onCheckedChange={field.onChange}
          />
        </div>
      )}
    />
  );
}

"use client";

import type { CharacterRelationshipDetailsView, Nullable, RelationshipCategory } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import type {
  RelationshipAuthoringSubject,
  RelationshipDraftState,
} from "../model/relationship-authoring";
import type { RelationshipBookStep } from "../model/relationship-book-step";
import type {
  RelationshipFormInput,
  RelationshipFormValues,
} from "../model/relationship-form-schema";

import { useUpdateRelationship } from "../api/use-update-relationship";
import { useUpsertRelationshipBookState } from "../api/use-upsert-relationship-book-state";
import {
  defaultRelationshipBookId,
  toRelationshipEditBookStep,
} from "../model/relationship-book-step";
import {
  findRelationshipBookState,
  relationshipBookStateDefaults,
  relationshipEditDefaults,
  toRelationshipBookStateChange,
  toRelationshipEdgeSignature,
  toUpdateRelationshipInput,
} from "../model/relationship-form-input";
import { buildRelationshipFormSchema } from "../model/relationship-form-schema";
import { toRelationshipFocusCharacterId } from "../model/relationship-scope";
import { useRelationshipFormMessages } from "../model/use-relationship-form-messages";
import { useRelationshipSaveErrorReporter } from "../model/use-relationship-save-error-reporter";
import { RelationshipBookField } from "./relationship-book-field";
import { RelationshipBookStateFields } from "./relationship-book-state-fields";
import { RelationshipFamilyCycleNotice } from "./relationship-family-cycle-notice";
import { RelationshipFormRootError } from "./relationship-form-root-error";
import { RelationshipLabelFields } from "./relationship-label-fields";
import { RelationshipParticipants } from "./relationship-participants";
import { RelationshipTypeFields } from "./relationship-type-fields";
import { RemoveRelationshipBookStateDialog } from "./remove-relationship-book-state-dialog";

const EDIT_FORM_IDS = {
  bookHeading: "relationship-edit-book-heading",
} as const;

const EDIT_HIDDEN_FIELDS: ReadonlySet<string> = new Set(["directionality", "source", "target"]);

type FamilyCycleNotice = {
  overridable: boolean;
  signature: string;
};

type RelationshipEditFormProps = {
  onCancel: () => void;
  onDraftChange: (draft: RelationshipDraftState) => void;
  onSaved: () => void;
  relationship: CharacterRelationshipDetailsView;
  subject: RelationshipAuthoringSubject;
};

type StateRemoval = {
  bookId: string;
  open: boolean;
};

export function RelationshipEditForm({
  onCancel,
  onDraftChange,
  onSaved,
  relationship,
  subject,
}: RelationshipEditFormProps) {
  const t = useTranslations("relationships.editor");
  const tToast = useTranslations("relationships.toast");
  const messages = useRelationshipFormMessages();
  const updateRelationship = useUpdateRelationship();
  const upsertBookState = useUpsertRelationshipBookState();
  const bookStep = toRelationshipEditBookStep({ ...subject, relationship });
  const [familyCycle, setFamilyCycle] = useState<Nullable<FamilyCycleNotice>>(null);
  const [removal, setRemoval] = useState<Nullable<StateRemoval>>(null);

  const form = useForm<RelationshipFormInput, unknown, RelationshipFormValues>({
    defaultValues: relationshipEditDefaults({
      bookId: defaultRelationshipBookId({ relationship, scope: subject.scope, step: bookStep }),
      relationship,
    }),
    mode: "onTouched",
    resolver: (values, context, options) =>
      zodResolver(
        buildRelationshipFormSchema({
          messages,
          rules: { book: "optional", participants: "optional" },
        }),
      )(values, context, options),
  });
  const {
    clearErrors,
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    register,
    resetField,
    setFocus,
    setValue,
  } = form;
  const [category, type, customType, bookId] = useWatch({
    control,
    name: ["category", "type", "customType", "bookId"],
  });
  const edgeSignature = toRelationshipEdgeSignature({
    category,
    customType,
    source: null,
    target: null,
    type,
  });
  const isFamilyCycleShown = familyCycle !== null && familyCycle.signature === edgeSignature;
  const storedState = findRelationshipBookState({ bookId, relationship });
  const selectedBookTitle = toBookTitle({ bookId, step: bookStep });

  useEffect(() => {
    onDraftChange({ isDirty, isPending: isSubmitting });
  }, [isDirty, isSubmitting, onDraftChange]);

  const reportSaveError = useRelationshipSaveErrorReporter({
    form,
    mode: "edit",
    onFamilyCycle: (overridable) => setFamilyCycle({ overridable, signature: edgeSignature }),
    onGone: onSaved,
    revealField: (field) => !EDIT_HIDDEN_FIELDS.has(field),
  });

  function changeCategory(next: RelationshipCategory) {
    setValue("category", next, { shouldDirty: true });
    setValue("type", next === "custom" ? "custom" : null, { shouldDirty: true });
    clearErrors(["type", "customType"]);
  }

  function changeBook(next: Nullable<string>) {
    setValue("bookId", next, { shouldDirty: true });
    setValue(
      "bookState",
      relationshipBookStateDefaults(findRelationshipBookState({ bookId: next, relationship })),
      { shouldDirty: true },
    );
    clearErrors("bookState");
  }

  function closeRemoval() {
    setRemoval((current) => (current === null ? null : { ...current, open: false }));
  }

  async function save(
    values: RelationshipFormValues,
    { allowFamilyCycle }: { allowFamilyCycle: boolean },
  ) {
    try {
      const update = toUpdateRelationshipInput({ allowFamilyCycle, relationship, values });
      const bookStateChange = toRelationshipBookStateChange({ relationship, values });
      if (update !== null) {
        await updateRelationship.mutateAsync({ input: update, relationshipId: relationship.id });
      }
      if (bookStateChange !== null) {
        await upsertBookState.mutateAsync({ ...bookStateChange, relationshipId: relationship.id });
      }
      toast.success(tToast("updated"));
      onSaved();
    } catch (error) {
      reportSaveError(error);
    }
  }

  const submit = handleSubmit((values) => save(values, { allowFamilyCycle: false }));
  const submitAllowingFamilyCycle = handleSubmit((values) =>
    save(values, { allowFamilyCycle: true }),
  );

  return (
    <>
      <form
        className="flex min-h-0 flex-1 flex-col gap-4"
        noValidate
        onSubmit={(event) => {
          if (isSubmitting) {
            event.preventDefault();
            return;
          }
          void submit(event);
        }}
      >
        <div className="-mx-1 flex min-h-0 flex-col gap-5 overflow-y-auto px-1 py-0.5">
          <div className="flex min-w-0 flex-col gap-2">
            <RelationshipParticipants
              edge={{
                directionality: relationship.directionality,
                source: {
                  avatar: null,
                  id: relationship.sourceCharacterId,
                  name: relationship.sourceCharacterName,
                },
                target: {
                  avatar: null,
                  id: relationship.targetCharacterId,
                  name: relationship.targetCharacterName,
                },
              }}
              focusCharacterId={toRelationshipFocusCharacterId(subject.scope)}
              size="dialog"
            />
            <p className="text-xs text-muted-foreground">{t("participants.locked")}</p>
          </div>
          <RelationshipTypeFields
            control={control}
            customDirectionality={{ kind: "fixed", value: relationship.directionality }}
            errors={errors}
            onCategoryChange={changeCategory}
            register={register}
          />
          <RelationshipLabelFields
            defaultOpen={relationship.sourceLabel !== null || relationship.targetLabel !== null}
            errors={errors}
            names={{
              source: relationship.sourceCharacterName,
              target: relationship.targetCharacterName,
            }}
            register={register}
          />
          <Separator />
          <section
            aria-labelledby={EDIT_FORM_IDS.bookHeading}
            className="flex min-w-0 flex-col gap-5"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="text-base font-medium text-foreground" id={EDIT_FORM_IDS.bookHeading}>
                {t("book.heading")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("book.editHint")}</p>
            </div>
            <RelationshipBookField
              control={control}
              error={errors.bookId}
              noBookLabel={t("book.noneEdit")}
              onBookChange={changeBook}
              step={bookStep}
            />
            {bookId === null ? null : (
              <>
                {storedState === null ? (
                  <p className="text-sm text-muted-foreground">{t("book.noState")}</p>
                ) : null}
                <RelationshipBookStateFields
                  control={control}
                  errors={errors}
                  register={register}
                />
                {storedState === null ? null : (
                  <Button
                    className="self-start"
                    disabled={isSubmitting}
                    onClick={() => setRemoval({ bookId: storedState.bookId, open: true })}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {t("book.remove")}
                  </Button>
                )}
              </>
            )}
          </section>
          {isFamilyCycleShown ? (
            <RelationshipFamilyCycleNotice
              isPending={isSubmitting}
              onConfirm={() => void submitAllowingFamilyCycle()}
              overridable={familyCycle.overridable}
            />
          ) : null}
          <RelationshipFormRootError message={errors.root?.server?.message} />
        </div>
        <DialogFooter className="shrink-0">
          <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
            {t("actions.cancel")}
          </Button>
          <Button disabled={isSubmitting || !isDirty} loading={isSubmitting} type="submit">
            {t("actions.save")}
          </Button>
        </DialogFooter>
      </form>

      {removal === null ? null : (
        <RemoveRelationshipBookStateDialog
          bookId={removal.bookId}
          bookTitle={selectedBookTitle}
          onClose={closeRemoval}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            setFocus("bookState.description");
          }}
          onRemoved={() => {
            resetField("bookState", { defaultValue: relationshipBookStateDefaults(null) });
            closeRemoval();
          }}
          open={removal.open}
          relationshipId={relationship.id}
        />
      )}
    </>
  );
}

function toBookTitle({
  bookId,
  step,
}: {
  bookId: Nullable<string>;
  step: RelationshipBookStep;
}): Nullable<string> {
  if (bookId === null) return null;
  if (step.kind === "fixed") return step.book.title;
  return step.options.find((option) => option.id === bookId)?.title ?? null;
}

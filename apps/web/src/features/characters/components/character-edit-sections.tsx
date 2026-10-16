"use client";

import type { ReactNode } from "react";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";

import { BOOK_CHARACTER_UNSPECIFIED, CHARACTER_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { Fragment, useId } from "react";
import { Controller, useController, useWatch } from "react-hook-form";

import { UiIcon, type UiIconName } from "@/components/icons";
import { SuggestionCombobox } from "@/components/suggestion-combobox";
import { ActionRow } from "@/components/ui/action-row";
import { FieldError as FieldErrorText } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useBookChapters } from "@/features/books/api/use-book-chapters";
import { ManageOwnSpeciesButton, type OwnSpeciesChange, SpeciesPicker } from "@/features/species";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { BookSpoilerFlag } from "../model/book-spoiler-flags";
import type { CharacterEditValues } from "../model/character-edit-form";

import { useCharacterCustomLabels } from "../api/use-character-custom-labels";
import { hasSpoilerValue, spoilerValuePresence } from "../model/book-spoiler-flags";
import { isBookFieldMasked } from "../model/character-inheritance";
import {
  ATTITUDE_OPTIONS,
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_STATUS,
  ENTITY_KIND_OPTIONS,
  GENDER_CUSTOM,
  GENDER_OPTIONS,
  NARRATOR_TYPE_OPTIONS,
} from "../model/character-options";
import { isFieldHidden } from "../model/character-spoiler";
import { CharacterCreatableSingleSelect } from "./character-creatable-single-select";
import { InheritedSelectField, InheritedTextField } from "./character-inherited-field";
import { InheritedSpeciesField } from "./character-inherited-species-field";
import { CharacterLongTextField } from "./character-long-text-field";
import { CharacterPronounsSelect } from "./character-pronouns-select";
import { CharacterRolePicker } from "./character-role-picker";
import { CharacterScopeBadge } from "./character-scope-badge";
import { CharacterSpoilerField } from "./character-spoiler-field";

type EditControl = Control<CharacterEditValues>;

type EditErrors = FieldErrors<CharacterEditValues>;

type FieldRequirement = "optional" | "required";

const SPOILER_FIELDS = [
  {
    fields: [
      { flag: "displayNameIsSpoiler", label: "displayName" },
      { flag: "portraitIsSpoiler", label: "portrait" },
      { flag: "statusIsSpoiler", label: "status" },
    ],
    title: "cards",
  },
  {
    fields: [
      { flag: "speciesOverrideIsSpoiler", label: "speciesOverride" },
      { flag: "descriptionIsSpoiler", label: "description" },
      { flag: "personalImpressionIsSpoiler", label: "personalImpression" },
      { flag: "appearanceNotesIsSpoiler", label: "appearanceNotes" },
    ],
    title: "details",
  },
] as const satisfies readonly {
  fields: readonly { flag: BookSpoilerFlag; label: string }[];
  title: string;
}[];

type EditRegister = UseFormRegister<CharacterEditValues>;

export function BookCharacterDescriptionsSection({
  control,
  errors,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");

  const descriptionSpoiler = useController({ control, name: "book.descriptionIsSpoiler" });
  const appearanceNotesSpoiler = useController({ control, name: "book.appearanceNotesIsSpoiler" });

  return (
    <EditSection
      action={<CharacterScopeBadge scope="book" />}
      description={t("bookSectionHint")}
      icon="book-open-text"
      title={t("descriptionsSection")}
    >
      <LabeledField
        htmlFor="character-book-description"
        label={t("bookDescription")}
        requirement="optional"
      >
        <CharacterLongTextField
          control={control}
          error={errors.book?.description}
          id="character-book-description"
          name="book.description"
          onValueChange={(next) => {
            if (!hasSpoilerValue.descriptionIsSpoiler(next)) {
              descriptionSpoiler.field.onChange(false);
            }
          }}
          placeholder={t("bookDescriptionPlaceholder")}
          register={register}
          rows={3}
        />
      </LabeledField>

      <LabeledField
        htmlFor="character-appearance-notes"
        label={t("appearanceNotes")}
        requirement="optional"
      >
        <CharacterLongTextField
          control={control}
          error={errors.book?.appearanceNotes}
          id="character-appearance-notes"
          name="book.appearanceNotes"
          onValueChange={(next) => {
            if (!hasSpoilerValue.appearanceNotesIsSpoiler(next)) {
              appearanceNotesSpoiler.field.onChange(false);
            }
          }}
          placeholder={t("appearanceNotesPlaceholder")}
          register={register}
          rows={3}
        />
      </LabeledField>
    </EditSection>
  );
}

export function BookCharacterNarrativeSection({
  bookId,
  control,
  errors,
  maskedFields,
  pageMax,
  register,
}: {
  bookId: string;
  control: EditControl;
  errors: EditErrors;
  maskedFields: readonly string[];
  pageMax: number;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tNarrator = useTranslations("characters.narratorType");
  const tNarratorDescription = useTranslations("characters.narratorTypeDescription");
  const povHintId = useId();
  const narratorDescriptionId = useId();
  const unreliableHintId = useId();

  const isPov = useWatch({ control, name: "book.isPovCharacter" });
  const isUnreliableNarrator = useWatch({ control, name: "book.isUnreliableNarrator" });
  const unreliableNarratorMasked = isFieldHidden(maskedFields, "unreliableNarrator");
  const firstAppearanceNote = useWatch({ control, name: "book.firstAppearanceNote" });
  const chaptersQuery = useBookChapters(bookId, { enabled: true });
  const firstNoteError = errors.book?.firstAppearanceNote;

  return (
    <EditSection
      action={<CharacterScopeBadge scope="book" />}
      description={t("narrativeSectionHint")}
      icon="quote"
      title={t("narrativeSection")}
    >
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">{t("firstAppearance")}</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField
            htmlFor="character-first-chapter"
            label={t("firstAppearanceChapter")}
            requirement="optional"
          >
            <Controller
              control={control}
              name="book.firstAppearanceChapter"
              render={({ field }) => (
                <SuggestionCombobox
                  describedBy={
                    errors.book?.firstAppearanceChapter
                      ? "character-first-chapter-error"
                      : undefined
                  }
                  id="character-first-chapter"
                  invalid={errors.book?.firstAppearanceChapter !== undefined}
                  maxLength={CHARACTER_TEXT_MAX.shortText}
                  onChange={field.onChange}
                  options={chaptersQuery.data ?? []}
                  placeholder={t("firstAppearanceChapterPlaceholder")}
                  value={field.value}
                />
              )}
            />
            <FieldErrorText
              error={errors.book?.firstAppearanceChapter}
              id="character-first-chapter-error"
            />
          </LabeledField>

          <LabeledField
            htmlFor="character-first-page"
            label={t("firstAppearancePage")}
            requirement="optional"
          >
            <Controller
              control={control}
              name="book.firstAppearancePage"
              render={({ field }) => (
                <Input
                  aria-describedby={
                    errors.book?.firstAppearancePage ? "character-first-page-error" : undefined
                  }
                  aria-invalid={errors.book?.firstAppearancePage !== undefined}
                  autoComplete="off"
                  className="h-10"
                  id="character-first-page"
                  inputMode="numeric"
                  max={pageMax}
                  min={1}
                  onBlur={field.onBlur}
                  onChange={(event) =>
                    field.onChange(event.target.value === "" ? null : Number(event.target.value))
                  }
                  onKeyDown={blockNegativeNumberKeys}
                  onPaste={blockNegativeNumberPaste}
                  placeholder={t("firstAppearancePagePlaceholder")}
                  ref={field.ref}
                  step={1}
                  type="number"
                  value={field.value ?? ""}
                />
              )}
            />
            <FieldErrorText
              error={errors.book?.firstAppearancePage}
              id="character-first-page-error"
            />
          </LabeledField>
        </div>

        <LabeledField
          htmlFor="character-first-note"
          label={t("firstAppearanceNote")}
          requirement="optional"
        >
          <Input
            aria-describedby={
              firstNoteError === undefined
                ? "character-first-note-counter"
                : "character-first-note-error character-first-note-counter"
            }
            aria-invalid={firstNoteError !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-first-note"
            maxLength={CHARACTER_TEXT_MAX.shortText}
            placeholder={t("firstAppearanceNotePlaceholder")}
            {...register("book.firstAppearanceNote")}
          />
          <div className="flex items-center justify-between gap-2">
            <FieldErrorText error={firstNoteError} id="character-first-note-error" />
            <span
              className="ml-auto text-xs text-muted-foreground tabular-nums"
              id="character-first-note-counter"
            >
              {firstAppearanceNote.length}/{CHARACTER_TEXT_MAX.shortText}
            </span>
          </div>
        </LabeledField>
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">{t("perspectiveGroup")}</h3>

        <Controller
          control={control}
          name="book.isPovCharacter"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <ActionRow
                className="px-0 py-1 [&_span]:whitespace-normal"
                title={t("pov")}
                trailing={(labelId) => (
                  <Switch
                    aria-describedby={povHintId}
                    aria-labelledby={labelId}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <p className="text-sm text-muted-foreground" id={povHintId}>
                {t("povHint")}
              </p>
            </div>
          )}
        />

        {isPov ? (
          <>
            <Controller
              control={control}
              name="book.narratorType"
              render={({ field }) => (
                <LabeledField htmlFor="character-narrator-type" label={t("narratorType")}>
                  <Select
                    onValueChange={(next) => field.onChange(toNarratorType(next))}
                    value={field.value ?? ""}
                  >
                    <SelectTrigger
                      aria-describedby={field.value === null ? undefined : narratorDescriptionId}
                      className="w-full data-[size=default]:h-10"
                      clearLabel={t("clearNarratorType")}
                      id="character-narrator-type"
                      isClearable={field.value !== null}
                      onClear={() => field.onChange(null)}
                    >
                      <SelectValue placeholder={t("narratorTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {NARRATOR_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {tNarrator(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.value === null ? null : (
                    <p className="text-sm text-muted-foreground" id={narratorDescriptionId}>
                      {tNarratorDescription(field.value)}
                    </p>
                  )}
                </LabeledField>
              )}
            />

            {unreliableNarratorMasked ? (
              <CharacterSpoilerField hidden label={t("unreliableNarrator")}>
                {null}
              </CharacterSpoilerField>
            ) : (
              <div
                aria-label={t("unreliableNarrator")}
                className="flex flex-col gap-1"
                role="group"
              >
                <Controller
                  control={control}
                  name="book.isUnreliableNarrator"
                  render={({ field }) => (
                    <ActionRow
                      className="px-0 py-1 [&_span]:whitespace-normal"
                      title={t("unreliableNarrator")}
                      trailing={(labelId) => (
                        <Switch
                          aria-describedby={unreliableHintId}
                          aria-labelledby={labelId}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                  )}
                />
                <p className="text-sm text-muted-foreground" id={unreliableHintId}>
                  {t("unreliableNarratorHint")}
                </p>
                {isUnreliableNarrator ? (
                  <Controller
                    control={control}
                    name="book.isUnreliableNarratorSpoiler"
                    render={({ field }) => (
                      <ActionRow
                        className="py-1 pr-0 pl-4 [&_span]:whitespace-normal"
                        title={t("unreliableNarratorSpoiler")}
                        trailing={(labelId) => (
                          <Switch
                            aria-labelledby={labelId}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                    )}
                  />
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </div>
    </EditSection>
  );
}

export function BookCharacterSpoilerSection({ control }: { control: EditControl }) {
  const t = useTranslations("characters.spoilers");
  const idPrefix = useId();
  const book = useWatch({ control, name: "book" });
  const present = spoilerValuePresence(book);

  return (
    <EditSection
      action={<CharacterScopeBadge scope="book" />}
      description={t("revealHint")}
      icon="eye-off"
      title={t("sectionTitle")}
    >
      {SPOILER_FIELDS.map((group) => (
        <div
          aria-labelledby={`${idPrefix}-${group.title}`}
          className="flex flex-col"
          key={group.title}
          role="group"
        >
          <h3 className="pb-1 text-sm font-semibold text-ink" id={`${idPrefix}-${group.title}`}>
            {t(`groups.${group.title}`)}
          </h3>
          {group.fields.map((entry, index) => (
            <Fragment key={entry.flag}>
              {index === 0 ? null : <Separator />}
              <Controller
                control={control}
                name={`book.${entry.flag}`}
                render={({ field }) => (
                  <div className="flex flex-col gap-0.5 py-2.5">
                    <ActionRow
                      className="px-0 py-0 [&_span]:whitespace-normal"
                      title={t(entry.label)}
                      trailing={(labelId) => (
                        <Switch
                          aria-describedby={`${idPrefix}-${entry.flag}-hint`}
                          aria-labelledby={labelId}
                          checked={present[entry.flag] && field.value}
                          disabled={!present[entry.flag]}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <p
                      className="pr-11 text-[0.8125rem] text-muted-foreground"
                      id={`${idPrefix}-${entry.flag}-hint`}
                    >
                      {present[entry.flag] ? t(`hints.${entry.label}`) : t("emptyValueHint")}
                    </p>
                  </div>
                )}
              />
            </Fragment>
          ))}
        </div>
      ))}
    </EditSection>
  );
}

export function CharacterAttitudeSection({
  control,
  errors,
  hasBookScope,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  hasBookScope: boolean;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tInheritance = useTranslations("characters.inheritance");
  const tAttitude = useTranslations("characters.attitude");
  const tCommon = useTranslations("common");

  const globalAttitude = useWatch({ control, name: "global.attitude" });
  const personalImpressionSpoiler = useController({
    control,
    name: "book.personalImpressionIsSpoiler",
  });

  return (
    <EditSection icon="heart" title={t("attitudeSection")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 text-sm font-semibold text-ink">{t("attitudeGlobalGroup")}</h3>
          <CharacterScopeBadge scope="global" />
        </div>

        <Controller
          control={control}
          name="global.attitude"
          render={({ field }) => (
            <LabeledField htmlFor="character-attitude" label={t("attitude")}>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  className="w-full data-[size=default]:h-10"
                  clearLabel={tCommon("clear")}
                  id="character-attitude"
                  isClearable={field.value !== ""}
                  onClear={() => field.onChange("")}
                >
                  <SelectValue placeholder={t("attitudePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {ATTITUDE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tAttitude(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>
          )}
        />
      </div>

      {hasBookScope ? (
        <>
          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-sm font-semibold text-ink">{t("attitudeBookGroup")}</h3>
              <CharacterScopeBadge scope="book" />
            </div>

            <Controller
              control={control}
              name="book.attitude"
              render={({ field }) => (
                <InheritedSelectField
                  globalLabel={globalAttitude === "" ? null : tAttitude(globalAttitude)}
                  globalValue={globalAttitude === "" ? null : globalAttitude}
                  id="character-book-attitude"
                  label={tInheritance("attitude")}
                  onChange={field.onChange}
                  optionLabel={(option) => tAttitude(option)}
                  options={ATTITUDE_OPTIONS}
                  value={field.value}
                />
              )}
            />

            <LabeledField
              htmlFor="character-personal-impression"
              label={t("personalImpression")}
              requirement="optional"
            >
              <CharacterLongTextField
                control={control}
                error={errors.book?.personalImpression}
                id="character-personal-impression"
                name="book.personalImpression"
                onValueChange={(next) => {
                  if (!hasSpoilerValue.personalImpressionIsSpoiler(next)) {
                    personalImpressionSpoiler.field.onChange(false);
                  }
                }}
                placeholder={t("personalImpressionPlaceholder")}
                register={register}
                rows={3}
              />
            </LabeledField>
          </div>
        </>
      ) : null}
    </EditSection>
  );
}

export function CharacterBasicsSection({
  control,
  errors,
  hasBookScope,
  maskedFields,
  onSpeciesChange,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  hasBookScope: boolean;
  maskedFields: readonly string[];
  onSpeciesChange: (change: OwnSpeciesChange) => void;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const tRoles = useTranslations("characters.form");

  const globalName = useWatch({ control, name: "global.name" });
  const globalSpecies = useWatch({ control, name: "global.species" });
  const gender = useController({ control, name: "global.gender" });
  const customGender = useController({ control, name: "global.customGender" });
  const genderError = errors.global?.customGender;
  const pronouns = useController({ control, name: "global.pronouns" });
  const pronounsError = errors.global?.pronouns;
  const displayNameSpoiler = useController({ control, name: "book.displayNameIsSpoiler" });
  const speciesOverrideSpoiler = useController({ control, name: "book.speciesOverrideIsSpoiler" });
  const status = useController({ control, name: "book.status" });
  const statusCustomText = useController({ control, name: "book.statusCustomText" });
  const statusSpoiler = useController({ control, name: "book.statusIsSpoiler" });
  const statusError = errors.book?.statusCustomText;
  const customLabels = useCharacterCustomLabels({ enabled: hasBookScope });

  return (
    <EditSection icon="user" title={t("basicsSection")}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="min-w-0 text-sm font-semibold text-ink">{t("basicsGlobalGroup")}</h3>
          <CharacterScopeBadge scope="global" />
        </div>

        <LabeledField htmlFor="character-name" label={t("name")} requirement="required">
          <Input
            aria-describedby={errors.global?.name ? "character-name-error" : undefined}
            aria-invalid={errors.global?.name !== undefined}
            aria-required="true"
            autoComplete="off"
            className="h-10"
            id="character-name"
            maxLength={CHARACTER_TEXT_MAX.name}
            placeholder={t("namePlaceholder")}
            {...register("global.name")}
          />
          <FieldErrorText error={errors.global?.name} id="character-name-error" />
        </LabeledField>

        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="global.entityKind"
            render={({ field }) => (
              <LabeledField htmlFor="character-entity-kind" label={t("entityKind")}>
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className="w-full data-[size=default]:h-10"
                    id="character-entity-kind"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_KIND_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {tEntity(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </LabeledField>
            )}
          />

          <div className="flex flex-col gap-2">
            <PickerCaption label={t("gender")} />
            <CharacterCreatableSingleSelect
              clearTo="unknown"
              customText={customGender.field.value}
              customTextSaved={!customGender.fieldState.isDirty}
              describedBy={genderError ? "character-gender-error" : undefined}
              invalid={genderError !== undefined}
              label={t("gender")}
              maxLength={CHARACTER_TEXT_MAX.customGender}
              onBlur={customGender.field.onBlur}
              onChange={(choice) => {
                gender.field.onChange(choice.option);
                customGender.field.onChange(choice.customText);
              }}
              optionLabel={(option) => tGender(option)}
              options={GENDER_OPTIONS}
              ref={(element) => customGender.field.ref(element)}
              sentinel={GENDER_CUSTOM}
              value={gender.field.value}
            />
            <FieldErrorText error={genderError} id="character-gender-error" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField htmlFor="character-species" label={t("species")} requirement="optional">
            <Controller
              control={control}
              name="global.species"
              render={({ field }) => (
                <>
                  <SpeciesPicker
                    inputId="character-species"
                    label={t("species")}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    placeholder={t("speciesPlaceholder")}
                    ref={field.ref}
                    value={field.value}
                  />
                  <ManageOwnSpeciesButton onSpeciesChange={onSpeciesChange} />
                </>
              )}
            />
          </LabeledField>

          <LabeledField htmlFor="character-pronouns" label={t("pronouns")} requirement="optional">
            <CharacterPronounsSelect
              describedBy={pronounsError ? "character-pronouns-error" : undefined}
              inputId="character-pronouns"
              invalid={pronounsError !== undefined}
              label={t("pronouns")}
              onBlur={pronouns.field.onBlur}
              onChange={pronouns.field.onChange}
              ref={(element) => pronouns.field.ref(element)}
              saved={!pronouns.fieldState.isDirty}
              value={pronouns.field.value}
            />
            <FieldErrorText error={pronounsError} id="character-pronouns-error" />
          </LabeledField>
        </div>

        <LabeledField
          htmlFor="character-global-description"
          label={t("globalDescription")}
          requirement="optional"
        >
          <CharacterLongTextField
            control={control}
            error={errors.global?.neutralDescription}
            id="character-global-description"
            name="global.neutralDescription"
            placeholder={t("globalDescriptionPlaceholder")}
            register={register}
            rows={4}
          />
        </LabeledField>
      </div>

      {hasBookScope ? (
        <>
          <Separator />

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 text-sm font-semibold text-ink">{t("basicsBookGroup")}</h3>
              <CharacterScopeBadge scope="book" />
            </div>

            <MaskedOr field="displayName" label={t("displayName")} maskedFields={maskedFields}>
              <Controller
                control={control}
                name="book.displayName"
                render={({ field }) => (
                  <InheritedTextField
                    error={errors.book?.displayName}
                    globalValue={textOrNull(globalName)}
                    id="character-display-name"
                    label={t("displayName")}
                    maxLength={CHARACTER_TEXT_MAX.shortText}
                    onChange={(next) => {
                      field.onChange(next);
                      if (!hasSpoilerValue.displayNameIsSpoiler(next)) {
                        displayNameSpoiler.field.onChange(false);
                      }
                    }}
                    placeholder={t("displayNamePlaceholder")}
                    value={field.value}
                  />
                )}
              />
            </MaskedOr>

            <MaskedOr
              field="speciesOverride"
              label={t("speciesInBook")}
              maskedFields={maskedFields}
            >
              <Controller
                control={control}
                name="book.speciesOverride"
                render={({ field }) => (
                  <InheritedSpeciesField
                    globalValue={globalSpecies}
                    id="character-species-override"
                    label={t("speciesInBook")}
                    onBlur={field.onBlur}
                    onChange={(next) => {
                      field.onChange(next);
                      if (!hasSpoilerValue.speciesOverrideIsSpoiler(next)) {
                        speciesOverrideSpoiler.field.onChange(false);
                      }
                    }}
                    onSpeciesChange={onSpeciesChange}
                    placeholder={t("speciesInBookPlaceholder")}
                    ref={field.ref}
                    value={field.value}
                  />
                )}
              />
            </MaskedOr>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="book.importance"
                render={({ field }) => (
                  <LabeledField htmlFor="character-importance" label={t("importance")}>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger
                        className="w-full data-[size=default]:h-10"
                        id="character-importance"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOOK_CHARACTER_IMPORTANCE.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {tImportance(option)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </LabeledField>
                )}
              />

              <div className="flex flex-col gap-2">
                <PickerCaption label={t("status")} />
                <CharacterCreatableSingleSelect
                  clearTo={BOOK_CHARACTER_UNSPECIFIED.status}
                  customText={statusCustomText.field.value}
                  customTextSaved={!statusCustomText.fieldState.isDirty}
                  describedBy={statusError ? "character-status-error" : undefined}
                  invalid={statusError !== undefined}
                  label={t("status")}
                  maxLength={CHARACTER_TEXT_MAX.shortText}
                  onBlur={statusCustomText.field.onBlur}
                  onChange={(choice) => {
                    status.field.onChange(choice.option);
                    statusCustomText.field.onChange(choice.customText);
                    if (!hasSpoilerValue.statusIsSpoiler(choice.option)) {
                      statusSpoiler.field.onChange(false);
                    }
                  }}
                  optionLabel={(option) => tStatus(option)}
                  options={BOOK_CHARACTER_STATUS.options}
                  ref={(element) => statusCustomText.field.ref(element)}
                  sentinel={BOOK_CHARACTER_STATUS.custom}
                  suggestions={{
                    heading: t("customStatusesHeading"),
                    labels: customLabels.data?.statuses ?? [],
                  }}
                  value={status.field.value}
                />
                <FieldErrorText error={statusError} id="character-status-error" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <PickerCaption label={tRoles("roles")} />
              <Controller
                control={control}
                name="book.roles"
                render={({ field }) => (
                  <CharacterRolePicker
                    customRoles={customLabels.data?.roles ?? []}
                    onChange={field.onChange}
                    value={field.value}
                  />
                )}
              />
            </div>
          </div>
        </>
      ) : null}
    </EditSection>
  );
}

export function EditSection({
  action,
  children,
  description,
  icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: string;
  icon: UiIconName;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-detail-block md:p-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 grow basis-64 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <UiIcon name={icon} size={18} />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-heading text-base leading-tight font-semibold text-ink">{title}</h2>
            {description === undefined ? null : (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action === undefined ? null : <div className="ml-auto shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}

function FieldLabel({
  htmlFor,
  label,
  requirement,
}: {
  htmlFor: string;
  label: string;
  requirement?: FieldRequirement;
}) {
  const t = useTranslations("characters.edit");

  if (requirement === "required") {
    return (
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        <span aria-hidden className="text-destructive">
          *
        </span>
      </div>
    );
  }

  return (
    <Label htmlFor={htmlFor}>
      {label}
      {requirement === "optional" ? (
        <>
          {" "}
          <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </>
      ) : null}
    </Label>
  );
}

function LabeledField({
  children,
  htmlFor,
  label,
  requirement,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  requirement?: FieldRequirement;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={htmlFor} label={label} requirement={requirement} />
      {children}
    </div>
  );
}

function MaskedOr({
  children,
  field,
  label,
  maskedFields,
}: {
  children: ReactNode;
  field: "displayName" | "speciesOverride";
  label: string;
  maskedFields: readonly string[];
}) {
  if (!isBookFieldMasked(maskedFields, field)) return children;

  return (
    <CharacterSpoilerField hidden label={label}>
      {null}
    </CharacterSpoilerField>
  );
}

function PickerCaption({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className="flex items-center gap-2 text-sm leading-none font-medium select-none"
    >
      {label}
    </span>
  );
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNarratorType(value: string): CharacterEditValues["book"]["narratorType"] {
  return NARRATOR_TYPE_OPTIONS.find((option) => option === value) ?? null;
}

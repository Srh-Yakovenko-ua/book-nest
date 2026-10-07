"use client";

import type { ReactNode } from "react";
import type { Control, FieldError, FieldErrors, UseFormRegister } from "react-hook-form";

import { CHARACTER_TEXT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { Fragment, useId } from "react";
import { Controller, useWatch } from "react-hook-form";

import { UiIcon, type UiIconName } from "@/components/icons";
import { ActionRow } from "@/components/ui/action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

import type { CharacterEditScope, CharacterEditValues } from "../model/character-edit-form";

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
import { CharacterAliasGroup } from "./character-alias-group";
import { InheritedSelectField, InheritedTextField } from "./character-inherited-field";
import { CharacterLongTextField } from "./character-long-text-field";
import { CharacterRolePicker } from "./character-role-picker";
import { CharacterSpoilerField } from "./character-spoiler-field";

type AliasFieldErrors = NonNullable<FieldErrors<CharacterEditValues>["global"]>["aliases"];

type EditControl = Control<CharacterEditValues>;

type EditErrors = FieldErrors<CharacterEditValues>;

type FieldRequirement = "optional" | "required";

const SPOILER_FIELDS = [
  { label: "displayName", name: "book.displayNameIsSpoiler" },
  { label: "status", name: "book.statusIsSpoiler" },
  { label: "description", name: "book.descriptionIsSpoiler" },
  { label: "personalImpression", name: "book.personalImpressionIsSpoiler" },
  { label: "appearanceNotes", name: "book.appearanceNotesIsSpoiler" },
  { label: "speciesOverride", name: "book.speciesOverrideIsSpoiler" },
  { label: "portrait", name: "book.portraitIsSpoiler" },
] as const;

const SPOILER_FLAG_NAMES = SPOILER_FIELDS.map((entry) => entry.name);

const SCOPE_BADGE = {
  book: { icon: "book", label: "scopeBook" },
  global: { icon: "globe", label: "scopeGlobal" },
} as const satisfies Record<CharacterEditScope, { icon: UiIconName; label: string }>;

type EditRegister = UseFormRegister<CharacterEditValues>;

export function BookCharacterInheritanceSection({
  control,
  errors,
  maskedFields,
}: {
  control: EditControl;
  errors: EditErrors;
  maskedFields: readonly string[];
}) {
  const t = useTranslations("characters.edit");
  const tInheritance = useTranslations("characters.inheritance");
  const tAttitude = useTranslations("characters.attitude");

  const globalName = useWatch({ control, name: "global.name" });
  const globalSpecies = useWatch({ control, name: "global.species" });
  const globalAttitude = useWatch({ control, name: "global.attitude" });

  return (
    <EditSection
      action={<ScopeBadge scope="book" />}
      description={t("inheritanceSectionHint")}
      icon="layers"
      title={t("inheritanceSection")}
    >
      <div className="flex flex-col gap-4">
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
                onChange={field.onChange}
                placeholder={t("displayNamePlaceholder")}
                value={field.value}
              />
            )}
          />
        </MaskedOr>

        <Separator />

        <MaskedOr field="speciesOverride" label={t("speciesInBook")} maskedFields={maskedFields}>
          <Controller
            control={control}
            name="book.speciesOverride"
            render={({ field }) => (
              <InheritedTextField
                error={errors.book?.speciesOverride}
                globalValue={textOrNull(globalSpecies)}
                id="character-species-override"
                label={t("speciesInBook")}
                maxLength={CHARACTER_TEXT_MAX.shortText}
                onChange={field.onChange}
                placeholder={t("speciesInBookPlaceholder")}
                value={field.value}
              />
            )}
          />
        </MaskedOr>

        <Separator />

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
      </div>
    </EditSection>
  );
}

export function BookCharacterMainSection({
  control,
  errors,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const tRoles = useTranslations("characters.form");

  const status = useWatch({ control, name: "book.status" });

  return (
    <EditSection
      action={<ScopeBadge scope="book" />}
      description={t("bookSectionHint")}
      icon="book-open-text"
      title={t("bookSection")}
    >
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

        <Controller
          control={control}
          name="book.status"
          render={({ field }) => (
            <LabeledField htmlFor="character-status" label={t("status")}>
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="w-full data-[size=default]:h-10" id="character-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOK_CHARACTER_STATUS.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tStatus(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>
          )}
        />
      </div>

      {status === BOOK_CHARACTER_STATUS.custom ? (
        <LabeledField
          htmlFor="character-status-custom"
          label={t("statusCustom")}
          requirement="optional"
        >
          <Input
            aria-describedby={
              errors.book?.statusCustomText ? "character-status-custom-error" : undefined
            }
            aria-invalid={errors.book?.statusCustomText !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-status-custom"
            maxLength={CHARACTER_TEXT_MAX.shortText}
            placeholder={t("statusCustomPlaceholder")}
            {...register("book.statusCustomText")}
          />
          <FieldErrorText
            error={errors.book?.statusCustomText}
            id="character-status-custom-error"
          />
        </LabeledField>
      ) : null}

      <div className="flex flex-col gap-2">
        <span
          aria-hidden
          className="flex items-center gap-2 text-sm leading-none font-medium select-none"
        >
          {tRoles("roles")}
        </span>
        <Controller
          control={control}
          name="book.roles"
          render={({ field }) => (
            <CharacterRolePicker onChange={field.onChange} value={field.value} />
          )}
        />
      </div>

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
          placeholder={t("appearanceNotesPlaceholder")}
          register={register}
          rows={3}
        />
      </LabeledField>

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
          placeholder={t("personalImpressionPlaceholder")}
          register={register}
          rows={3}
        />
      </LabeledField>
    </EditSection>
  );
}

export function BookCharacterNarrativeSection({
  control,
  errors,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tNarrator = useTranslations("characters.narratorType");

  const isPov = useWatch({ control, name: "book.isPovCharacter" });

  return (
    <EditSection
      action={<ScopeBadge scope="book" />}
      description={t("narrativeSectionHint")}
      icon="quote"
      title={t("narrativeSection")}
    >
      <div className="flex flex-col gap-4">
        <Controller
          control={control}
          name="book.isPovCharacter"
          render={({ field }) => (
            <ActionRow
              className="px-0 py-1"
              title={t("pov")}
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

        {isPov ? (
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
              </LabeledField>
            )}
          />
        ) : null}
      </div>

      <Separator />

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">{t("firstAppearance")}</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <LabeledField
            htmlFor="character-first-chapter"
            label={t("firstAppearanceChapter")}
            requirement="optional"
          >
            <Input
              aria-describedby={
                errors.book?.firstAppearanceChapter ? "character-first-chapter-error" : undefined
              }
              aria-invalid={errors.book?.firstAppearanceChapter !== undefined}
              autoComplete="off"
              className="h-10"
              id="character-first-chapter"
              maxLength={CHARACTER_TEXT_MAX.shortText}
              placeholder={t("firstAppearanceChapterPlaceholder")}
              {...register("book.firstAppearanceChapter")}
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
            <Input
              aria-describedby={
                errors.book?.firstAppearancePage ? "character-first-page-error" : undefined
              }
              aria-invalid={errors.book?.firstAppearancePage !== undefined}
              autoComplete="off"
              className="h-10"
              id="character-first-page"
              inputMode="numeric"
              placeholder={t("firstAppearancePagePlaceholder")}
              {...register("book.firstAppearancePage")}
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
              errors.book?.firstAppearanceNote ? "character-first-note-error" : undefined
            }
            aria-invalid={errors.book?.firstAppearanceNote !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-first-note"
            maxLength={CHARACTER_TEXT_MAX.shortText}
            placeholder={t("firstAppearanceNotePlaceholder")}
            {...register("book.firstAppearanceNote")}
          />
          <FieldErrorText
            error={errors.book?.firstAppearanceNote}
            id="character-first-note-error"
          />
        </LabeledField>
      </div>
    </EditSection>
  );
}

export function BookCharacterSpoilerSection({ control }: { control: EditControl }) {
  const t = useTranslations("characters.spoilers");
  const hidePresenceHintId = useId();
  const flags = useWatch({ control, name: SPOILER_FLAG_NAMES });
  const activeCount = flags.filter(Boolean).length;

  return (
    <EditSection
      action={<ScopeBadge scope="book" />}
      description={t("sectionHint")}
      icon="eye-off"
      title={t("sectionTitle")}
    >
      <Controller
        control={control}
        name="book.hidePresenceAsSpoiler"
        render={({ field }) => (
          <div className="flex flex-col gap-1">
            <ActionRow
              className="px-0 py-1 [&_span]:whitespace-normal"
              title={t("hidePresence")}
              trailing={(labelId) => (
                <Switch
                  aria-describedby={hidePresenceHintId}
                  aria-labelledby={labelId}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <p className="text-sm text-muted-foreground" id={hidePresenceHintId}>
              {t("hidePresenceHint")}
            </p>
          </div>
        )}
      />

      <Separator />

      <Collapsible className="flex flex-col gap-3" defaultOpen={activeCount > 0}>
        <CollapsibleTrigger asChild>
          <Button
            className="group/disclosure -ml-2.5 h-auto min-h-8 self-start py-1.5 text-left whitespace-normal"
            type="button"
            variant="ghost"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              {t("expand")}
              {activeCount > 0 ? (
                <Badge variant="secondary">{t("activeCount", { count: activeCount })}</Badge>
              ) : null}
            </span>
            <UiIcon
              className="transition-transform group-data-[state=open]/disclosure:rotate-180 motion-reduce:transition-none"
              name="chevron-down"
              size={16}
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="flex flex-col">
          <p className="pb-1 text-xs text-muted-foreground">{t("granularHint")}</p>
          {SPOILER_FIELDS.map((entry, index) => (
            <Fragment key={entry.name}>
              {index === 0 ? null : <Separator />}
              <Controller
                control={control}
                name={entry.name}
                render={({ field }) => (
                  <ActionRow
                    className="px-0 py-2.5"
                    title={t(entry.label)}
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
            </Fragment>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </EditSection>
  );
}

export function CharacterAliasesSection({
  control,
  errors,
  hasBookScope,
}: {
  control: EditControl;
  errors: FieldErrors<CharacterEditValues>;
  hasBookScope: boolean;
}) {
  const t = useTranslations("characters.aliases");

  return (
    <EditSection description={t("sectionHint")} icon="tag" title={t("sectionTitle")}>
      <Controller
        control={control}
        name="global.aliases"
        render={({ field }) => (
          <CharacterAliasGroup
            description={t("globalHint")}
            errors={aliasNameErrors(errors.global?.aliases, field.value.length)}
            idPrefix="character-alias-global"
            onChange={field.onChange}
            title={t("globalTitle")}
            value={field.value}
          />
        )}
      />

      {hasBookScope ? (
        <>
          <Separator />
          <Controller
            control={control}
            name="book.aliases"
            render={({ field }) => (
              <CharacterAliasGroup
                description={t("bookHint")}
                errors={aliasNameErrors(errors.book?.aliases, field.value.length)}
                idPrefix="character-alias-book"
                onChange={field.onChange}
                title={t("bookTitle")}
                value={field.value}
              />
            )}
          />
        </>
      ) : null}
    </EditSection>
  );
}

export function CharacterGlobalSection({
  control,
  errors,
  register,
}: {
  control: EditControl;
  errors: EditErrors;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const tAttitude = useTranslations("characters.attitude");
  const tCommon = useTranslations("common");

  const gender = useWatch({ control, name: "global.gender" });

  return (
    <EditSection
      action={<ScopeBadge scope="global" />}
      description={t("globalSectionHint")}
      icon="user"
      title={t("globalSection")}
    >
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

        <Controller
          control={control}
          name="global.gender"
          render={({ field }) => (
            <LabeledField htmlFor="character-gender" label={t("gender")}>
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
            </LabeledField>
          )}
        />
      </div>

      {gender === GENDER_CUSTOM ? (
        <LabeledField
          htmlFor="character-custom-gender"
          label={t("customGender")}
          requirement="required"
        >
          <Input
            aria-describedby={
              errors.global?.customGender ? "character-custom-gender-error" : undefined
            }
            aria-invalid={errors.global?.customGender !== undefined}
            aria-required="true"
            autoComplete="off"
            className="h-10"
            id="character-custom-gender"
            maxLength={CHARACTER_TEXT_MAX.customGender}
            placeholder={t("customGenderPlaceholder")}
            {...register("global.customGender")}
          />
          <FieldErrorText error={errors.global?.customGender} id="character-custom-gender-error" />
        </LabeledField>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledField htmlFor="character-species" label={t("species")} requirement="optional">
          <Input
            aria-describedby={errors.global?.species ? "character-species-error" : undefined}
            aria-invalid={errors.global?.species !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-species"
            maxLength={CHARACTER_TEXT_MAX.species}
            placeholder={t("speciesPlaceholder")}
            {...register("global.species")}
          />
          <FieldErrorText error={errors.global?.species} id="character-species-error" />
        </LabeledField>

        <LabeledField htmlFor="character-pronouns" label={t("pronouns")} requirement="optional">
          <Input
            aria-describedby={errors.global?.pronouns ? "character-pronouns-error" : undefined}
            aria-invalid={errors.global?.pronouns !== undefined}
            autoComplete="off"
            className="h-10"
            id="character-pronouns"
            maxLength={CHARACTER_TEXT_MAX.pronouns}
            placeholder={t("pronounsPlaceholder")}
            {...register("global.pronouns")}
          />
          <FieldErrorText error={errors.global?.pronouns} id="character-pronouns-error" />
        </LabeledField>
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
    </EditSection>
  );
}

function aliasNameErrors(entries: AliasFieldErrors, count: number): (FieldError | undefined)[] {
  return Array.from({ length: count }, (_unused, index) => entries?.[index]?.name);
}

function EditSection({
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

function ScopeBadge({ scope }: { scope: CharacterEditScope }) {
  const t = useTranslations("characters.edit");
  const badge = SCOPE_BADGE[scope];

  return (
    <Badge variant="outline">
      <UiIcon name={badge.icon} size={12} />
      {t(badge.label)}
    </Badge>
  );
}

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNarratorType(value: string): CharacterEditValues["book"]["narratorType"] {
  return NARRATOR_TYPE_OPTIONS.find((option) => option === value) ?? null;
}

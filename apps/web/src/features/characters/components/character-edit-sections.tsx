"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";
import type { Control, FieldError, FieldErrors, UseFormRegister } from "react-hook-form";

import { useTranslations } from "next-intl";
import { Controller, useWatch } from "react-hook-form";

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

import type { CharacterEditValues } from "../model/character-edit-form";

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
import {
  InheritedImageField,
  InheritedSelectField,
  InheritedTextField,
} from "./character-inherited-field";
import { CharacterRolePicker } from "./character-role-picker";
import { CharacterSpoilerField } from "./character-spoiler-field";

type AliasFieldErrors = NonNullable<FieldErrors<CharacterEditValues>["global"]>["aliases"];

type EditControl = Control<CharacterEditValues>;

type EditRegister = UseFormRegister<CharacterEditValues>;

export function BookCharacterInheritanceSection({
  control,
  globalAvatarUrl,
  maskedFields,
  portraitUrl,
}: {
  control: EditControl;
  globalAvatarUrl: Nullable<string>;
  maskedFields: readonly string[];
  portraitUrl: Nullable<string>;
}) {
  const t = useTranslations("characters.edit");
  const tInheritance = useTranslations("characters.inheritance");
  const tAttitude = useTranslations("characters.attitude");

  const globalName = useWatch({ control, name: "global.name" });
  const globalSpecies = useWatch({ control, name: "global.species" });
  const globalAttitude = useWatch({ control, name: "global.attitude" });

  return (
    <EditSection description={t("inheritanceSectionHint")} title={t("inheritanceSection")}>
      <MaskedOr field="displayName" label={t("displayName")} maskedFields={maskedFields}>
        <Controller
          control={control}
          name="book.displayName"
          render={({ field }) => (
            <InheritedTextField
              globalValue={textOrNull(globalName)}
              id="character-display-name"
              label={t("displayName")}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </MaskedOr>

      <MaskedOr field="portrait" label={t("portrait")} maskedFields={maskedFields}>
        <Controller
          control={control}
          name="book.portraitMediaId"
          render={({ field }) => (
            <InheritedImageField
              fallbackText={globalName}
              globalPreviewUrl={globalAvatarUrl}
              label={t("portrait")}
              onChange={field.onChange}
              previewUrl={portraitUrl}
              value={field.value}
            />
          )}
        />
      </MaskedOr>

      <MaskedOr field="speciesOverride" label={t("speciesInBook")} maskedFields={maskedFields}>
        <Controller
          control={control}
          name="book.speciesOverride"
          render={({ field }) => (
            <InheritedTextField
              globalValue={textOrNull(globalSpecies)}
              id="character-species-override"
              label={t("speciesInBook")}
              onChange={field.onChange}
              value={field.value}
            />
          )}
        />
      </MaskedOr>

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
    </EditSection>
  );
}

export function BookCharacterMainSection({
  control,
  register,
}: {
  control: EditControl;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tImportance = useTranslations("characters.importance");
  const tStatus = useTranslations("characters.status");
  const tRoles = useTranslations("characters.form");

  const status = useWatch({ control, name: "book.status" });

  return (
    <EditSection description={t("bookSectionHint")} title={t("bookSection")}>
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
        <LabeledField htmlFor="character-status-custom" label={t("statusCustom")}>
          <Input
            className="h-10"
            id="character-status-custom"
            {...register("book.statusCustomText")}
          />
        </LabeledField>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>{tRoles("roles")}</Label>
        <Controller
          control={control}
          name="book.roles"
          render={({ field }) => (
            <CharacterRolePicker onChange={field.onChange} value={field.value} />
          )}
        />
      </div>

      <LabeledField htmlFor="character-book-description" label={t("bookDescription")}>
        <Textarea id="character-book-description" rows={3} {...register("book.description")} />
      </LabeledField>

      <LabeledField htmlFor="character-personal-impression" label={t("personalImpression")}>
        <Textarea
          id="character-personal-impression"
          rows={3}
          {...register("book.personalImpression")}
        />
      </LabeledField>
    </EditSection>
  );
}

export function BookCharacterNarrativeSection({
  control,
  pageError,
  register,
}: {
  control: EditControl;
  pageError: ReactNode;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tNarrator = useTranslations("characters.narratorType");

  const isPov = useWatch({ control, name: "book.isPovCharacter" });

  return (
    <EditSection description={t("narrativeSectionHint")} title={t("narrativeSection")}>
      <Controller
        control={control}
        name="book.isPovCharacter"
        render={({ field }) => (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Switch checked={field.value} onCheckedChange={field.onChange} />
            {t("pov")}
          </label>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledField htmlFor="character-first-chapter" label={t("firstAppearanceChapter")}>
          <Input
            className="h-10"
            id="character-first-chapter"
            placeholder={t("firstAppearanceChapterPlaceholder")}
            {...register("book.firstAppearanceChapter")}
          />
        </LabeledField>

        <LabeledField htmlFor="character-first-page" label={t("firstAppearancePage")}>
          <Input
            className="h-10"
            id="character-first-page"
            inputMode="numeric"
            {...register("book.firstAppearancePage")}
          />
          {pageError}
        </LabeledField>
      </div>

      <LabeledField htmlFor="character-first-note" label={t("firstAppearanceNote")}>
        <Input
          className="h-10"
          id="character-first-note"
          {...register("book.firstAppearanceNote")}
        />
      </LabeledField>
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
    <EditSection description={t("sectionHint")} title={t("sectionTitle")}>
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
      ) : null}
    </EditSection>
  );
}

export function CharacterGlobalSection({
  control,
  nameError,
  register,
}: {
  control: EditControl;
  nameError: ReactNode;
  register: EditRegister;
}) {
  const t = useTranslations("characters.edit");
  const tEntity = useTranslations("characters.entityKind");
  const tGender = useTranslations("characters.gender");
  const tAttitude = useTranslations("characters.attitude");
  const tCommon = useTranslations("common");

  const gender = useWatch({ control, name: "global.gender" });

  return (
    <EditSection description={t("globalSectionHint")} title={t("globalSection")}>
      <LabeledField htmlFor="character-name" label={t("name")} required>
        <Input
          autoComplete="off"
          className="h-10"
          id="character-name"
          {...register("global.name")}
        />
        {nameError}
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
        <LabeledField htmlFor="character-custom-gender" label={t("customGender")}>
          <Input
            className="h-10"
            id="character-custom-gender"
            {...register("global.customGender")}
          />
        </LabeledField>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <LabeledField htmlFor="character-species" label={t("species")}>
          <Input className="h-10" id="character-species" {...register("global.species")} />
        </LabeledField>

        <LabeledField htmlFor="character-pronouns" label={t("pronouns")}>
          <Input className="h-10" id="character-pronouns" {...register("global.pronouns")} />
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

      <LabeledField htmlFor="character-global-description" label={t("globalDescription")}>
        <Textarea
          id="character-global-description"
          rows={4}
          {...register("global.neutralDescription")}
        />
      </LabeledField>
    </EditSection>
  );
}

function aliasNameErrors(entries: AliasFieldErrors, count: number): (FieldError | undefined)[] {
  return Array.from({ length: count }, (_unused, index) => entries?.[index]?.name);
}

function EditSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg text-ink">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function LabeledField({
  children,
  htmlFor,
  label,
  required,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required === true ? <span aria-hidden> *</span> : null}
      </Label>
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
  field: "displayName" | "portrait" | "speciesOverride";
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

function textOrNull(value: string): null | string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function toNarratorType(value: string): CharacterEditValues["book"]["narratorType"] {
  return NARRATOR_TYPE_OPTIONS.find((option) => option === value) ?? null;
}

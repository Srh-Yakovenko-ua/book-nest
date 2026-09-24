"use client";

import type { ReactNode } from "react";
import type { Control, UseFormRegister } from "react-hook-form";

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
import { Textarea } from "@/components/ui/textarea";

import type { CharacterEditValues } from "../model/character-edit-form";

import {
  ATTITUDE_OPTIONS,
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_STATUS,
  ENTITY_KIND_OPTIONS,
  GENDER_CUSTOM,
  GENDER_OPTIONS,
} from "../model/character-options";
import { CharacterRolePicker } from "./character-role-picker";

type EditControl = Control<CharacterEditValues>;

type EditRegister = UseFormRegister<CharacterEditValues>;

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

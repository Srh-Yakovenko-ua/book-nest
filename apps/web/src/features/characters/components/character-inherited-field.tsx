"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CharacterImageField } from "./character-image-field";

type InheritedFieldShellProps = {
  action: ReactNode;
  children: ReactNode;
  htmlFor?: string;
  isInherited: boolean;
  label: string;
};

type InheritedImageFieldProps = {
  fallbackText: string;
  globalPreviewUrl: Nullable<string>;
  label: string;
  onChange: (mediaId: null | string) => void;
  previewUrl: Nullable<string>;
  value: Nullable<string>;
};

type InheritedSelectFieldProps<T extends string> = {
  globalLabel: Nullable<string>;
  globalValue: Nullable<T>;
  id: string;
  label: string;
  onChange: (value: null | T) => void;
  optionLabel: (option: T) => string;
  options: readonly T[];
  value: Nullable<T>;
};

type InheritedTextFieldProps = {
  globalValue: Nullable<string>;
  id: string;
  label: string;
  onChange: (value: null | string) => void;
  value: Nullable<string>;
};

export function InheritedImageField({
  fallbackText,
  globalPreviewUrl,
  label,
  onChange,
  previewUrl,
  value,
}: InheritedImageFieldProps) {
  const t = useTranslations("characters.inheritance");
  const isInherited = value === null;

  return (
    <InheritedFieldShell action={null} isInherited={isInherited} label={label}>
      <CharacterImageField
        fallbackText={fallbackText}
        initialPreviewUrl={(isInherited ? globalPreviewUrl : previewUrl) ?? undefined}
        label={label}
        onChange={onChange}
        removeLabel={t("resetImage")}
        uploadLabel={isInherited ? t("specifyImageForBook") : t("replaceImage")}
        value={value}
      />
    </InheritedFieldShell>
  );
}

export function InheritedSelectField<T extends string>({
  globalLabel,
  globalValue,
  id,
  label,
  onChange,
  optionLabel,
  options,
  value,
}: InheritedSelectFieldProps<T>) {
  const isInherited = value === null;

  return (
    <InheritedFieldShell
      action={
        <InheritanceAction
          globalIsEmpty={globalValue === null}
          isInherited={isInherited}
          onOverride={() => onChange(globalValue ?? options[0] ?? null)}
          onReset={() => onChange(null)}
        />
      }
      htmlFor={id}
      isInherited={isInherited}
      label={label}
    >
      {isInherited ? (
        <InheritedTextPreview value={globalLabel} />
      ) : (
        <Select onValueChange={(next) => onChange(next as T)} value={value}>
          <SelectTrigger className="w-full data-[size=default]:h-10" id={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {optionLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </InheritedFieldShell>
  );
}

export function InheritedTextField({
  globalValue,
  id,
  label,
  onChange,
  value,
}: InheritedTextFieldProps) {
  const isInherited = value === null;

  return (
    <InheritedFieldShell
      action={
        <InheritanceAction
          globalIsEmpty={globalValue === null}
          isInherited={isInherited}
          onOverride={() => onChange(globalValue ?? "")}
          onReset={() => onChange(null)}
        />
      }
      htmlFor={id}
      isInherited={isInherited}
      label={label}
    >
      {isInherited ? (
        <InheritedTextPreview value={globalValue} />
      ) : (
        <Input
          className="h-10"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </InheritedFieldShell>
  );
}

function InheritanceAction({
  globalIsEmpty,
  isInherited,
  onOverride,
  onReset,
}: {
  globalIsEmpty: boolean;
  isInherited: boolean;
  onOverride: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("characters.inheritance");

  return (
    <Button
      className="h-auto shrink-0 p-0"
      onClick={isInherited ? onOverride : onReset}
      size="xs"
      type="button"
      variant="link"
    >
      {isInherited
        ? globalIsEmpty
          ? t("specifyForBook")
          : t("overrideForBook")
        : t("resetToGlobal")}
    </Button>
  );
}

function InheritedFieldShell({
  action,
  children,
  htmlFor,
  isInherited,
  label,
}: InheritedFieldShellProps) {
  const t = useTranslations("characters.inheritance");

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border p-3"
      data-slot="inherited-field"
    >
      <div className="flex items-start justify-between gap-3">
        <Label htmlFor={isInherited ? undefined : htmlFor}>{label}</Label>
        {action}
      </div>

      {children}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <UiIcon name={isInherited ? "link" : "edit"} size={12} />
        {isInherited ? t("usingGlobal") : t("bookOnly")}
      </p>
    </div>
  );
}

function InheritedTextPreview({ value }: { value: Nullable<string> }) {
  const t = useTranslations("characters.inheritance");

  return (
    <p className={value === null ? "text-sm text-muted-foreground" : "text-sm text-foreground"}>
      {value ?? t("notSpecified")}
    </p>
  );
}

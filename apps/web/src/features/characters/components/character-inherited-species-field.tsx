"use client";

import type { Nullable } from "@app/shared";
import type { RefCallback } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  ManageOwnSpeciesButton,
  type OwnSpeciesChange,
  SpeciesPicker,
  type SpeciesSelection,
} from "@/features/species";

import {
  InheritanceAction,
  InheritedFieldShell,
  InheritedTextPreview,
} from "./character-inherited-field";

type InheritedSpeciesFieldProps = {
  globalValue: Nullable<SpeciesSelection>;
  id: string;
  label: string;
  onBlur: () => void;
  onChange: (value: Nullable<SpeciesSelection>) => void;
  onSpeciesChange: (change: OwnSpeciesChange) => void;
  placeholder: string;
  ref: RefCallback<HTMLInputElement>;
  value: Nullable<SpeciesSelection>;
};

export function InheritedSpeciesField({
  globalValue,
  id,
  label,
  onBlur,
  onChange,
  onSpeciesChange,
  placeholder,
  ref,
  value,
}: InheritedSpeciesFieldProps) {
  const t = useTranslations("characters.edit");
  const [isSpecifying, setIsSpecifying] = useState(false);
  const [observed, setObserved] = useState({ globalValue, value });

  if (observed.globalValue !== globalValue || observed.value !== value) {
    setObserved({ globalValue, value });
    setIsSpecifying(false);
  }

  const isInherited = value === null && !isSpecifying;

  function changeOverride(next: Nullable<SpeciesSelection>) {
    setIsSpecifying(false);
    onChange(next);
  }

  return (
    <InheritedFieldShell
      action={
        <InheritanceAction
          globalIsEmpty={globalValue === null}
          isInherited={isInherited}
          onOverride={() => {
            setIsSpecifying(globalValue === null);
            onChange(globalValue);
          }}
          onReset={() => changeOverride(null)}
        />
      }
      htmlFor={id}
      isInherited={isInherited}
      label={
        <>
          {label} <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span>
        </>
      }
    >
      {isInherited ? (
        <InheritedTextPreview value={globalValue?.label ?? null} />
      ) : (
        <div className="flex flex-col gap-1.5">
          <SpeciesPicker
            inputId={id}
            label={label}
            onBlur={onBlur}
            onChange={changeOverride}
            placeholder={placeholder}
            ref={ref}
            value={value}
          />
          <ManageOwnSpeciesButton onSpeciesChange={onSpeciesChange} />
        </div>
      )}
    </InheritedFieldShell>
  );
}

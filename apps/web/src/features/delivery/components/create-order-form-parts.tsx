"use client";

import type { ReactNode } from "react";

import { DateField } from "@/components/date-field";
import { UiIcon, type UiIconName } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

const MONEY_STEP = "1";

export function Field({
  children,
  className,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required ? (
          <span aria-hidden className="text-sm leading-none text-destructive">
            *
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function FormSection({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: UiIconName;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <header className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <UiIcon name={icon} size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-heading text-base leading-tight font-semibold text-ink">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function LabeledDateField({
  allowFuture,
  className,
  disablePast,
  id,
  label,
  onChange,
  optional,
  value,
}: {
  allowFuture?: boolean;
  className?: string;
  disablePast?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional}>
      <DateField
        allowFuture={allowFuture}
        ariaLabel={label}
        className="h-10"
        disablePast={disablePast}
        id={id}
        onChange={(next) => onChange(next ?? "")}
        value={value}
      />
    </Field>
  );
}

export function MoneyField({
  className,
  hideSteppers = false,
  label,
  onChange,
  optional,
  required,
  value,
}: {
  className?: string;
  hideSteppers?: boolean;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  required?: boolean;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional} required={required}>
      <Input
        aria-label={label}
        className={
          hideSteppers
            ? "h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            : "h-10"
        }
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={blockNegativeNumberKeys}
        onPaste={blockNegativeNumberPaste}
        step={MONEY_STEP}
        type="number"
        value={value}
      />
    </Field>
  );
}

export function TextField({
  className,
  label,
  onChange,
  optional,
  type = "text",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional}>
      <Input
        className="h-10"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </Field>
  );
}

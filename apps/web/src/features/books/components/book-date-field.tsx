"use client";

import { format, isValid, parse } from "date-fns";

import { DatePicker } from "@/components/ui/date-picker";

const ISO_FORMAT = "yyyy-MM-dd";
const YEAR_SPAN = 10;

type BookDateFieldProps = {
  allowFuture?: boolean;
  ariaLabel: string;
  className?: string;
  describedBy?: string;
  disablePast?: boolean;
  id: string;
  invalid?: boolean;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  value: unknown;
};

export function BookDateField({
  allowFuture = false,
  ariaLabel,
  className,
  describedBy,
  disablePast = false,
  id,
  invalid,
  onChange,
  placeholder,
  value,
}: BookDateFieldProps) {
  const now = new Date();
  const startMonth = disablePast ? now : new Date(now.getFullYear() - YEAR_SPAN, 0, 1);
  const endMonth = allowFuture ? new Date(now.getFullYear() + YEAR_SPAN, 11, 31) : now;

  return (
    <DatePicker
      allowFuture={allowFuture}
      ariaLabel={ariaLabel}
      className={className}
      defaultMonth={now}
      describedBy={describedBy}
      disablePast={disablePast}
      endMonth={endMonth}
      id={id}
      invalid={invalid}
      onChange={(date) => onChange(date ? format(date, ISO_FORMAT) : undefined)}
      placeholder={placeholder}
      startMonth={startMonth}
      value={parseIsoDate(value)}
    />
  );
}

function parseIsoDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = parse(value, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

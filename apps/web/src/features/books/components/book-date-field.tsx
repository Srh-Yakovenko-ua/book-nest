"use client";

import { addYears, endOfYear, format, isValid, parse, startOfYear, subYears } from "date-fns";

import { DatePicker } from "@/components/ui/date-picker";
import { useWeekStartsOn } from "@/features/settings";

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
  const weekStartsOn = useWeekStartsOn();
  const now = new Date();
  const startMonth = disablePast ? now : startOfYear(subYears(now, YEAR_SPAN));
  const endMonth = allowFuture ? endOfYear(addYears(now, YEAR_SPAN)) : now;

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
      weekStartsOn={weekStartsOn}
    />
  );
}

function parseIsoDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  const parsed = parse(value, ISO_FORMAT, new Date());
  return isValid(parsed) ? parsed : undefined;
}

"use client";

import { format } from "date-fns";
import { enUS, uk } from "date-fns/locale";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { type DropdownProps, type Locale } from "react-day-picker";

import { UiIcon } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  defaultMonth?: Date;
  describedBy?: string;
  disabled?: boolean;
  endMonth?: Date;
  id: string;
  invalid?: boolean;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  startMonth?: Date;
  value?: Date;
};

const DATE_FNS_LOCALES: Record<string, Locale> = { en: enUS, uk };

export function DatePicker({
  defaultMonth,
  describedBy,
  disabled,
  endMonth,
  id,
  invalid,
  onChange,
  placeholder,
  startMonth,
  value,
}: DatePickerProps) {
  const t = useTranslations("auth.datePicker");
  const locale = useLocale();
  const dfLocale = DATE_FNS_LOCALES[locale] ?? uk;
  const [open, setOpen] = useState(false);

  const today = new Date();

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-describedby={describedBy}
        aria-invalid={invalid === true || undefined}
        aria-label={t("triggerLabel")}
        className={cn(
          "relative flex h-12 w-full cursor-pointer items-center rounded-md border border-border bg-card pr-3.5 pl-11 text-left text-base transition-[border-color,box-shadow] duration-150 outline-none",
          "hover:border-accent-border",
          "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/20",
          "data-[state=open]:border-primary data-[state=open]:ring-4 data-[state=open]:ring-ring/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid === true &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15 data-[state=open]:border-destructive data-[state=open]:ring-destructive/15",
          value ? "text-foreground" : "text-muted-foreground",
        )}
        disabled={disabled}
        id={id}
      >
        <UiIcon
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3.5",
            invalid === true ? "text-destructive" : "text-muted-foreground",
          )}
          name="calendar"
          size={18}
        />
        {value
          ? format(value, "d MMMM yyyy", { locale: dfLocale })
          : (placeholder ?? t("placeholder"))}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2.5"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          const content = event.currentTarget;
          if (!(content instanceof HTMLElement)) return;
          const day = content.querySelector<HTMLButtonElement>(
            '[role="grid"] button[tabindex="0"]',
          );
          day?.focus();
        }}
      >
        <Calendar
          captionLayout="dropdown"
          className="p-0 [--cell-size:--spacing(8.5)]"
          classNames={{
            dropdowns: "flex w-full items-center gap-2",
            month_caption: "mb-3 flex h-auto w-full items-center justify-center px-0",
            months: "gap-3",
            nav: "hidden",
          }}
          components={{ Dropdown: CalendarDropdown }}
          defaultMonth={value ?? defaultMonth}
          disabled={{ after: today }}
          endMonth={endMonth}
          labels={{
            labelMonthDropdown: () => t("monthLabel"),
            labelYearDropdown: () => t("yearLabel"),
          }}
          locale={dfLocale}
          mode="single"
          onSelect={(date) => {
            onChange(date);
            if (date) setOpen(false);
          }}
          selected={value}
          startMonth={startMonth}
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarDropdown({ options, value, onChange, "aria-label": ariaLabel }: DropdownProps) {
  const handleValueChange = (next: string) => {
    onChange?.({ target: { value: next } } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <Select onValueChange={handleValueChange} value={value?.toString()}>
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-9 flex-1 gap-1 rounded-sm border-border bg-card px-2.5 font-medium"
        size="sm"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options?.map((option) => (
          <SelectItem disabled={option.disabled} key={option.value} value={option.value.toString()}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

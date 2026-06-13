"use client";

import type { ReactNode } from "react";

import { forwardRef } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

type AuthTextFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  error?: ReactNode;
  hint?: ReactNode;
  icon: UiIconName;
  id: string;
  invalid?: boolean;
  label: ReactNode;
  optionalLabel?: string;
  rightSlot?: ReactNode;
  status?: ReactNode;
};

export const AuthTextField = forwardRef<HTMLInputElement, AuthTextFieldProps>(
  function AuthTextField(
    {
      className,
      error,
      hint,
      icon,
      id,
      invalid,
      label,
      optionalLabel,
      rightSlot,
      status,
      ...props
    },
    ref,
  ) {
    return (
      <div className="flex flex-col">
        <label
          className="mb-2 flex items-center gap-1.5 text-sm leading-tight font-semibold text-foreground"
          htmlFor={id}
        >
          {label}
          {optionalLabel === undefined ? null : (
            <span className="text-xs font-medium text-muted-foreground">{optionalLabel}</span>
          )}
        </label>
        <div className="relative flex items-center">
          <UiIcon
            aria-hidden
            className={cn(
              "pointer-events-none absolute left-3.5",
              invalid === true ? "text-destructive" : "text-muted-foreground",
            )}
            name={icon}
            size={18}
          />
          <input
            className={cn(
              "h-12 w-full rounded-md border border-border bg-card pr-3.5 pl-11 text-base text-foreground transition-[border-color,box-shadow] duration-150 outline-none",
              "placeholder:text-muted-foreground",
              "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-ring/20",
              invalid === true &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15",
              rightSlot !== undefined && "pr-12",
              className,
            )}
            id={id}
            ref={ref}
            {...props}
          />
          {rightSlot}
        </div>
        {error}
        {status}
        {hint === undefined ? null : (
          <p className="mt-2 text-xs leading-snug text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  },
);

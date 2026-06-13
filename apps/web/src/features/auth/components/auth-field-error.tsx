"use client";

import type { FieldError as RhfFieldError } from "react-hook-form";

import { useTranslations } from "next-intl";

import { resolveFieldMessage } from "../lib/auth-error-messages";

type AuthFieldErrorProps = {
  error?: RhfFieldError;
  field: string;
  id: string;
};

export function AuthFieldError({ error, field, id }: AuthFieldErrorProps) {
  const t = useTranslations("auth");
  if (error?.message === undefined) return null;

  const resolved = resolveFieldMessage(field, error.message);
  const text = resolved.kind === "key" ? t(resolved.key) : resolved.text;
  if (text === "") return null;

  return (
    <p
      className="mt-[7px] flex items-center gap-1.5 text-[0.8rem] text-destructive"
      id={id}
      role="alert"
    >
      <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-destructive" />
      {text}
    </p>
  );
}

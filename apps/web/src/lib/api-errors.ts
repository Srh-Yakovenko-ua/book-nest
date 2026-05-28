import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { toast } from "sonner";

import { ApiError } from "@/lib/http-client";

export function applyFieldErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  err: unknown,
): boolean {
  if (!(err instanceof ApiError) || !err.fieldErrors?.length) return false;
  for (const fieldError of err.fieldErrors) {
    form.setError(fieldError.field as Path<T>, { message: fieldError.message });
  }
  return true;
}

export function applyMessageToFields<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: Path<T>[],
  message: string,
): void {
  for (const field of fields) {
    form.setError(field, { message });
  }
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const first = err.fieldErrors?.[0]?.message;
    if (first) return first;
    if (err.message && !err.message.startsWith("HTTP ")) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function hasFieldError(err: unknown, field: string): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.fieldErrors?.some((fieldError) => fieldError.field === field) ?? false;
}

export function toastApiError(err: unknown, fallback: string): void {
  if (err instanceof ApiError && err.fieldErrors?.length) return;
  toast.error(getErrorMessage(err, fallback));
}

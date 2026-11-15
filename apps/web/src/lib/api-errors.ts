import type { ValueOf } from "@app/shared";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";

import { ApiError } from "@/lib/http-client";

export const HTTP_STATUS = {
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  notFound: 404,
  unprocessableEntity: 422,
} as const;

type HttpStatus = ValueOf<typeof HTTP_STATUS>;

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

export function isApiErrorCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

export function isApiErrorStatus(error: unknown, status: HttpStatus): boolean {
  return error instanceof ApiError && error.status === status;
}

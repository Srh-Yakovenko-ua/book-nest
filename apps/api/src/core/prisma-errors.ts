import type { Nullable } from "@app/shared";

import { z } from "zod";

import { Prisma } from "../generated/prisma/client.js";

const UNIQUE_CONSTRAINT_CODE = "P2002";
const FOREIGN_KEY_CONSTRAINT_CODE = "P2003";
const RECORD_NOT_FOUND_CODE = "P2025";
const WRITE_CONFLICT_CODE = "P2034";

const CONSTRAINT_NAME_PATTERN = /unique constraint "([^"]+)"/;

const DriverAdapterUniqueViolationSchema = z.object({
  driverAdapterError: z.object({ cause: z.object({ originalMessage: z.string() }) }),
});

export function isForeignKeyConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FOREIGN_KEY_CONSTRAINT_CODE
  );
}

export function isRecordNotFoundError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND_CODE
  );
}

export function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_CODE
  );
}

export function isUniqueConstraintErrorOn(error: unknown, constraint: string): boolean {
  if (!isUniqueConstraintError(error)) {
    return false;
  }
  const target = error.meta?.target;
  if (typeof target === "string") {
    return target === constraint;
  }
  if (Array.isArray(target)) {
    return target.includes(constraint);
  }
  return readConstraintName(error.meta) === constraint;
}

export function isWriteConflictError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === WRITE_CONFLICT_CODE
  );
}

export function rethrowUniqueConstraintAs({
  error,
  toError,
}: {
  error: unknown;
  toError: () => Error;
}): never {
  if (isUniqueConstraintError(error)) {
    throw toError();
  }
  throw error;
}

function readConstraintName(meta: unknown): Nullable<string> {
  const parsed = DriverAdapterUniqueViolationSchema.safeParse(meta);
  if (!parsed.success) {
    return null;
  }
  return (
    CONSTRAINT_NAME_PATTERN.exec(parsed.data.driverAdapterError.cause.originalMessage)?.[1] ?? null
  );
}

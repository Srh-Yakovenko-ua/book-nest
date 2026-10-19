import type { Nullable } from "@app/shared";

import { z } from "zod";

import { Prisma } from "../generated/prisma/client.js";

const UNIQUE_CONSTRAINT_CODE = "P2002";
const FOREIGN_KEY_CONSTRAINT_CODE = "P2003";
const RECORD_NOT_FOUND_CODE = "P2025";
const RETRYABLE_TRANSACTION_FAILURES = {
  prismaCodes: ["P2034", "P2028"],
  sqlStates: ["40001", "40P01"],
} as const;

const CONSTRAINT_NAME_PATTERN = /unique constraint "([^"]+)"/;

const DriverAdapterUniqueViolationSchema = z.object({
  driverAdapterError: z.object({ cause: z.object({ originalMessage: z.string() }) }),
});

const DriverAdapterSqlStateSchema = z.object({
  driverAdapterError: z.object({ cause: z.object({ originalCode: z.string() }) }),
});

const SqlStateErrorSchema = z.object({ code: z.string() });

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

export function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (RETRYABLE_TRANSACTION_FAILURES.prismaCodes.some((code) => code === error.code)) {
      return true;
    }
    return isRetryableSqlState(readSqlState(error.meta));
  }
  const raw = SqlStateErrorSchema.safeParse(error);
  return raw.success && isRetryableSqlState(raw.data.code);
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

function isRetryableSqlState(sqlState: Nullable<string>): boolean {
  return (
    sqlState !== null && RETRYABLE_TRANSACTION_FAILURES.sqlStates.some((code) => code === sqlState)
  );
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

function readSqlState(meta: unknown): Nullable<string> {
  const parsed = DriverAdapterSqlStateSchema.safeParse(meta);
  return parsed.success ? parsed.data.driverAdapterError.cause.originalCode : null;
}

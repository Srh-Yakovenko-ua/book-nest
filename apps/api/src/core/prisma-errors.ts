import { Prisma } from "../generated/prisma/client.js";

const UNIQUE_CONSTRAINT_CODE = "P2002";
const FOREIGN_KEY_CONSTRAINT_CODE = "P2003";
const RECORD_NOT_FOUND_CODE = "P2025";
const WRITE_CONFLICT_CODE = "P2034";

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
  return Array.isArray(target) && target.includes(constraint);
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

import { Prisma } from "../generated/prisma/client.js";

const UNIQUE_CONSTRAINT_CODE = "P2002";

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

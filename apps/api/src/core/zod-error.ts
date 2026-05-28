import type { ApiErrorResult } from "@app/shared";
import type { ZodError } from "zod";

export function mapZodError(error: ZodError): ApiErrorResult {
  return {
    errorsMessages: error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    })),
  };
}

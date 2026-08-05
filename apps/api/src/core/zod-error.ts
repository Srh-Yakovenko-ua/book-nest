import type { ApiErrorResult } from "@app/shared";
import type { ZodError } from "zod";

export const ZOD_ERROR_REPORTING = {
  maxReportedIssues: 50,
} as const satisfies Record<string, number>;

export function mapZodError(error: ZodError): ApiErrorResult {
  return {
    errorsMessages: error.issues
      .slice(0, ZOD_ERROR_REPORTING.maxReportedIssues)
      .map((issue) => ({ field: issue.path.join("."), message: issue.message })),
  };
}

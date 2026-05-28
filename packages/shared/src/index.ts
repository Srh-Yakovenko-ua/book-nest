import { z } from "zod";

export type ApiError = {
  code?: string;
  message: string;
  requestId?: string;
};

export type ApiErrorResult = {
  errorsMessages: FieldError[];
};

export type ApiHealth = {
  postgres: "down" | "ok";
  status: "degraded" | "down" | "ok";
  timestamp: string;
  uptimeSeconds: number;
};

export type FieldError = {
  field: string;
  message: string;
};

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export const LIST_PAGE_SIZE_MAX = 100;

export const PaginationQuerySchema = z.object({
  pageNumber: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(LIST_PAGE_SIZE_MAX).default(10),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

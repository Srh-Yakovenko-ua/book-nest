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
  code?: string;
  field: string;
  message: string;
  meta?: Record<string, string>;
};

export type Nullable<T> = null | T;

export type Paginator<T> = {
  items: T[];
  page: number;
  pagesCount: number;
  pageSize: number;
  totalCount: number;
};

export type ValueOf<T> = T[keyof T];

export const LIST_PAGE_SIZE_MAX = 100;

const HTML_TAG = /<\/?[a-zA-Z][^>]*>|<!--|<!\w/;

export const noHtmlTags = (value: string): boolean => !HTML_TAG.test(value);

export function collapseHorizontalSpaces(value: string): string {
  return value.replace(/[^\S\n]+/g, " ").trim();
}

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return collapseSpaces(name).toLowerCase();
}

export const createPaginatedSchema = <ItemSchema extends z.ZodType>(item: ItemSchema) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pagesCount: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
  });

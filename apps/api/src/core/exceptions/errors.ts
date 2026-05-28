import type { FieldError } from "@app/shared";

import { HTTP_STATUS, type HttpStatus } from "../http-status.js";

export class HttpError extends Error {
  readonly bodyless: boolean;
  readonly code?: string;
  readonly status: HttpStatus;

  constructor(
    status: HttpStatus,
    message: string,
    options?: { bodyless?: boolean; code?: string },
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = options?.code;
    this.bodyless = options?.bodyless ?? false;
  }
}

export class BadRequestError extends HttpError {
  readonly fields?: FieldError[];

  constructor(message: string, options?: { code?: string; fields?: FieldError[] }) {
    super(HTTP_STATUS.BAD_REQUEST, message, { code: options?.code });
    this.name = "BadRequestError";
    this.fields = options?.fields;
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden", options?: { code?: string }) {
    super(HTTP_STATUS.FORBIDDEN, message, { bodyless: true, code: options?.code });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not found", options?: { bodyless?: boolean; code?: string }) {
    super(HTTP_STATUS.NOT_FOUND, message, options);
    this.name = "NotFoundError";
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = "Too many requests", options?: { code?: string }) {
    super(HTTP_STATUS.TOO_MANY_REQUESTS, message, { code: options?.code });
    this.name = "TooManyRequestsError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized", options?: { code?: string }) {
    super(HTTP_STATUS.UNAUTHORIZED, message, { bodyless: true, code: options?.code });
    this.name = "UnauthorizedError";
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, options?: { code?: string }) {
    super(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, { code: options?.code });
    this.name = "ValidationError";
  }
}

import type { ValueOf } from "@app/shared";

export const HTTP_STATUS = {
  ACCEPTED: 202,
  BAD_GATEWAY: 502,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  OK: 200,
  PAYLOAD_TOO_LARGE: 413,
  SERVICE_UNAVAILABLE: 503,
  TOO_MANY_REQUESTS: 429,
  UNAUTHORIZED: 401,
  UNPROCESSABLE_ENTITY: 422,
} as const satisfies Record<string, number>;

export type HttpStatus = ValueOf<typeof HTTP_STATUS>;

const HTTP_STATUS_VALUES: ReadonlySet<number> = new Set(Object.values(HTTP_STATUS));

export function isHttpStatus(value: number): value is HttpStatus {
  return HTTP_STATUS_VALUES.has(value);
}

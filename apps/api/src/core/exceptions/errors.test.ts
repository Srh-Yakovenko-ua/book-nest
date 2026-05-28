import { describe, expect, it } from "vitest";

import { HTTP_STATUS } from "../http-status.js";
import {
  BadRequestError,
  ForbiddenError,
  HttpError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

describe("HttpError base class", () => {
  it("stores status, message, name and defaults bodyless to false", () => {
    const error = new HttpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "boom");

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
    expect(error.message).toBe("boom");
    expect(error.name).toBe("HttpError");
    expect(error.bodyless).toBe(false);
    expect(error.code).toBeUndefined();
  });

  it("accepts bodyless and code options", () => {
    const error = new HttpError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "boom", {
      bodyless: true,
      code: "INTERNAL",
    });

    expect(error.bodyless).toBe(true);
    expect(error.code).toBe("INTERNAL");
  });
});

describe("BadRequestError", () => {
  it("uses BAD_REQUEST status, custom name, bodyless false and no fields by default", () => {
    const error = new BadRequestError("bad input");

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.BAD_REQUEST);
    expect(error.message).toBe("bad input");
    expect(error.name).toBe("BadRequestError");
    expect(error.bodyless).toBe(false);
    expect(error.fields).toBeUndefined();
  });

  it("carries the provided fields array", () => {
    const fields = [
      { field: "login", message: "required" },
      { field: "password", message: "too short" },
    ];
    const error = new BadRequestError("validation failed", { fields });

    expect(error.fields).toEqual(fields);
  });

  it("surfaces the provided code", () => {
    const error = new BadRequestError("bad", { code: "EMAIL_TAKEN" });

    expect(error.code).toBe("EMAIL_TAKEN");
  });
});

describe("ForbiddenError", () => {
  it("defaults to FORBIDDEN status, 'Forbidden' message and bodyless true", () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(error.message).toBe("Forbidden");
    expect(error.name).toBe("ForbiddenError");
    expect(error.bodyless).toBe(true);
  });

  it("accepts a custom message and code", () => {
    const error = new ForbiddenError("not your blog", { code: "BLOG_OWNERSHIP" });

    expect(error.message).toBe("not your blog");
    expect(error.code).toBe("BLOG_OWNERSHIP");
    expect(error.bodyless).toBe(true);
  });
});

describe("UnauthorizedError", () => {
  it("defaults to UNAUTHORIZED status, 'Unauthorized' message and bodyless true", () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    expect(error.message).toBe("Unauthorized");
    expect(error.name).toBe("UnauthorizedError");
    expect(error.bodyless).toBe(true);
  });

  it("accepts a custom message and code", () => {
    const error = new UnauthorizedError("expired", { code: "TOKEN_EXPIRED" });

    expect(error.message).toBe("expired");
    expect(error.code).toBe("TOKEN_EXPIRED");
    expect(error.bodyless).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("defaults to NOT_FOUND status, 'Not found' message and bodyless false", () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(error.message).toBe("Not found");
    expect(error.name).toBe("NotFoundError");
    expect(error.bodyless).toBe(false);
  });

  it("accepts custom message, code and bodyless override", () => {
    const error = new NotFoundError("user gone", { bodyless: true, code: "USER_MISSING" });

    expect(error.message).toBe("user gone");
    expect(error.code).toBe("USER_MISSING");
    expect(error.bodyless).toBe(true);
  });
});

describe("TooManyRequestsError", () => {
  it("defaults to TOO_MANY_REQUESTS status, default message and bodyless false", () => {
    const error = new TooManyRequestsError();

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.TOO_MANY_REQUESTS);
    expect(error.message).toBe("Too many requests");
    expect(error.name).toBe("TooManyRequestsError");
    expect(error.bodyless).toBe(false);
  });

  it("accepts a custom code", () => {
    const error = new TooManyRequestsError("slow down", { code: "RATE_LIMITED" });

    expect(error.message).toBe("slow down");
    expect(error.code).toBe("RATE_LIMITED");
  });
});

describe("ValidationError", () => {
  it("uses UNPROCESSABLE_ENTITY status, custom name and bodyless false", () => {
    const error = new ValidationError("bad shape");

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    expect(error.message).toBe("bad shape");
    expect(error.name).toBe("ValidationError");
    expect(error.bodyless).toBe(false);
  });

  it("accepts a custom code", () => {
    const error = new ValidationError("bad", { code: "SCHEMA_FAIL" });

    expect(error.code).toBe("SCHEMA_FAIL");
  });
});

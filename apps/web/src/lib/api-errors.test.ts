import { PUBLISHER_NAME_ERROR_CODES, TIMELINE_ERROR_CODES } from "@app/shared";
import { describe, expect, it } from "vitest";

import { HTTP_STATUS, isApiErrorCode, isApiErrorStatus } from "./api-errors";
import { ApiError } from "./http-client";

const duplicateNameError = new ApiError(
  409,
  "duplicate",
  undefined,
  PUBLISHER_NAME_ERROR_CODES.duplicateName,
);

const lookalikeError = Object.assign(new Error("duplicate"), {
  code: PUBLISHER_NAME_ERROR_CODES.duplicateName,
  status: 409,
});

describe("isApiErrorCode", () => {
  it("matches an API error that carries the code", () => {
    expect(isApiErrorCode(duplicateNameError, "PUBLISHER_DUPLICATE_NAME")).toBe(true);
  });

  it("rejects an API error that carries another code", () => {
    expect(isApiErrorCode(duplicateNameError, TIMELINE_ERROR_CODES.reorderConflict)).toBe(false);
  });

  it("rejects an API error of the same status that carries no code", () => {
    expect(
      isApiErrorCode(new ApiError(409, "conflict"), PUBLISHER_NAME_ERROR_CODES.duplicateName),
    ).toBe(false);
  });

  it.each([
    ["a plain error with the same code", lookalikeError],
    ["a string", "PUBLISHER_DUPLICATE_NAME"],
    ["undefined", undefined],
  ])("rejects %s", (_label, error) => {
    expect(isApiErrorCode(error, PUBLISHER_NAME_ERROR_CODES.duplicateName)).toBe(false);
  });
});

describe("isApiErrorStatus", () => {
  it("matches an API error with the status", () => {
    expect(isApiErrorStatus(new ApiError(409, "conflict"), HTTP_STATUS.conflict)).toBe(true);
  });

  it("rejects an API error with another status", () => {
    expect(isApiErrorStatus(new ApiError(422, "invalid"), HTTP_STATUS.conflict)).toBe(false);
  });

  it.each([
    ["a plain error with the same status", lookalikeError],
    ["a string", "409"],
    ["undefined", undefined],
  ])("rejects %s", (_label, error) => {
    expect(isApiErrorStatus(error, HTTP_STATUS.conflict)).toBe(false);
  });
});

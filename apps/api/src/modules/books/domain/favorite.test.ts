import { describe, expect, it } from "vitest";

import { resolveFavoriteChange } from "./favorite.js";

const NOW = new Date("2026-02-01T10:00:00.000Z");

describe("resolveFavoriteChange", () => {
  it("stamps the timestamp when a book becomes a favorite", () => {
    expect(resolveFavoriteChange({ current: false, next: true, now: NOW })).toEqual({
      favoriteAddedAt: NOW,
      isFavorite: true,
    });
  });

  it("clears the timestamp when a book stops being a favorite", () => {
    expect(resolveFavoriteChange({ current: true, next: false, now: NOW })).toEqual({
      favoriteAddedAt: null,
      isFavorite: false,
    });
  });

  it("returns no change when an already-favorite book stays a favorite", () => {
    expect(resolveFavoriteChange({ current: true, next: true, now: NOW })).toBeNull();
  });

  it("returns no change when a non-favorite book stays a non-favorite", () => {
    expect(resolveFavoriteChange({ current: false, next: false, now: NOW })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { legacyGenresTagsHref } from "./legacy-genres-tags-href";

describe("legacyGenresTagsHref", () => {
  it("sends the old Tags tab to the Tags page", () => {
    expect(legacyGenresTagsHref({ tab: "tags" })).toBe("/tags");
  });

  it("sends the old Genres tab to the Genres page", () => {
    expect(legacyGenresTagsHref({ tab: "genres" })).toBe("/genres");
  });

  it("falls back to the Genres page without a tab or with an unknown one", () => {
    expect(legacyGenresTagsHref({})).toBe("/genres");
    expect(legacyGenresTagsHref({ tab: "authors" })).toBe("/genres");
    expect(legacyGenresTagsHref({ tab: ["tags", "genres"] })).toBe("/genres");
  });
});

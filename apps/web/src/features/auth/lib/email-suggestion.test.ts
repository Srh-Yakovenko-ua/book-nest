import { describe, expect, it } from "vitest";

import { suggestEmailDomain } from "./email-suggestion";

describe("suggestEmailDomain", () => {
  it("suggests gmail.com for a common typo", () => {
    expect(suggestEmailDomain("user@gmial.com")).toBe("user@gmail.com");
  });

  it("suggests outlook.com for a near miss", () => {
    expect(suggestEmailDomain("jane@outlok.com")).toBe("jane@outlook.com");
  });

  it("returns null for an exact common domain", () => {
    expect(suggestEmailDomain("user@gmail.com")).toBeNull();
  });

  it("returns null for an unrelated domain", () => {
    expect(suggestEmailDomain("user@company.co")).toBeNull();
  });

  it("returns null when there is no domain part", () => {
    expect(suggestEmailDomain("user@")).toBeNull();
  });

  it("returns null when there is no local part", () => {
    expect(suggestEmailDomain("@gmail.com")).toBeNull();
  });

  it("returns null when there is no at sign", () => {
    expect(suggestEmailDomain("user.gmail.com")).toBeNull();
  });

  it("preserves the local part when suggesting", () => {
    expect(suggestEmailDomain("first.last@yaho.com")).toBe("first.last@yahoo.com");
  });
});

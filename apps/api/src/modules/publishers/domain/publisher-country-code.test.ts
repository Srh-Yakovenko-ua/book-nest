import { UpdatePublisherInputSchema } from "@app/shared";
import { describe, expect, it } from "vitest";

describe("UpdatePublisherInputSchema countryCode", () => {
  it.each(["UA", "US", "GB"])("accepts the ISO 3166-1 alpha-2 code %s", (countryCode) => {
    expect(UpdatePublisherInputSchema.parse({ countryCode })).toEqual({ countryCode });
  });

  it.each(["XX", "ZZ"])("rejects the unassigned two-letter code %s", (countryCode) => {
    expect(UpdatePublisherInputSchema.safeParse({ countryCode }).success).toBe(false);
  });

  it("trims and uppercases a lowercase code before checking it", () => {
    expect(UpdatePublisherInputSchema.parse({ countryCode: " ua " })).toEqual({
      countryCode: "UA",
    });
  });

  it("accepts null to clear the country and omission to keep it", () => {
    expect(UpdatePublisherInputSchema.parse({ countryCode: null })).toEqual({ countryCode: null });
    expect(UpdatePublisherInputSchema.parse({})).toEqual({});
  });
});

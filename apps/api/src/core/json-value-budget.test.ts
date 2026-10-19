import { describe, expect, it } from "vitest";

import { exceedsJsonValueBudget } from "./json-value-budget.js";

const BUDGET = {
  importObjectMembers: 64,
  importValues: 524_288,
  unboundedObjectMembers: 1_000_000,
} as const;

function exceeds(json: string, maxValues: number): boolean {
  return exceedsJsonValueBudget({
    body: Buffer.from(json, "utf8"),
    maxObjectMembers: BUDGET.unboundedObjectMembers,
    maxValues,
  });
}

function exceedsMemberCap(json: string): boolean {
  return exceedsJsonValueBudget({
    body: Buffer.from(json, "utf8"),
    maxObjectMembers: BUDGET.importObjectMembers,
    maxValues: BUDGET.importValues,
  });
}

function objectWithKeys({
  count,
  memberValue = () => "0",
}: {
  count: number;
  memberValue?: (index: number) => string;
}): string {
  const members = Array.from(
    { length: count },
    (_unused, index) => `"k${index}":${memberValue(index)}`,
  );
  return `{${members.join(",")}}`;
}

describe("exceedsJsonValueBudget", () => {
  it("counts every brace, bracket and comma outside strings against the budget", () => {
    const json = '{"a":[1,2],"b":{}}';

    expect(exceeds(json, 5)).toBe(false);
    expect(exceeds(json, 4)).toBe(true);
  });

  it("does not count structural characters inside a string", () => {
    const json = '["{[,{[,{[,"]';

    expect(exceeds(json, 1)).toBe(false);
    expect(exceeds(json, 0)).toBe(true);
  });

  it("keeps a string open past an escaped quote", () => {
    const json = '["a\\"{,[",1]';

    expect(exceeds(json, 2)).toBe(false);
    expect(exceeds(json, 1)).toBe(true);
  });

  it("closes a string after an escaped backslash so the following commas count", () => {
    const json = '["a\\\\",{},{}]';

    expect(exceeds(json, 5)).toBe(false);
    expect(exceeds(json, 4)).toBe(true);
  });

  it("ignores multi-byte characters inside strings", () => {
    const json = '["Їжак, «ліс» [ { ,"]';

    expect(exceeds(json, 1)).toBe(false);
  });

  it("never exceeds the budget for an empty body", () => {
    expect(exceeds("", 0)).toBe(false);
  });
});

describe("exceedsJsonValueBudget object member cap", () => {
  it("rejects an object with one member over the cap", () => {
    expect(exceedsMemberCap(objectWithKeys({ count: 65 }))).toBe(true);
  });

  it("accepts an object with exactly the capped number of members", () => {
    expect(exceedsMemberCap(objectWithKeys({ count: 64 }))).toBe(false);
  });

  it("accepts an appearance-shaped object with 30 members", () => {
    expect(exceedsMemberCap(`[${objectWithKeys({ count: 30, memberValue: () => "null" })}]`)).toBe(
      false,
    );
  });

  it("rejects a single object of 524K identical keys that fits the value budget", () => {
    const json = `{${'"a":0,'.repeat(524_220)}"a":0}`;

    expect(exceedsMemberCap(json)).toBe(true);
  });

  it("does not count commas, braces or keys inside string values", () => {
    const json = objectWithKeys({
      count: 64,
      memberValue: (index) => `"${'"k":1, {"x":[1,2]}, '.replaceAll('"', '\\"')}${index}"`,
    });

    expect(exceedsMemberCap(json)).toBe(false);
  });

  it("counts nested objects independently of their parent", () => {
    const nested = objectWithKeys({ count: 40 });
    const json = objectWithKeys({ count: 40, memberValue: () => nested });

    expect(exceedsMemberCap(json)).toBe(false);
  });

  it("leaves arrays to their own limits", () => {
    expect(exceedsMemberCap(`[${"0,".repeat(999)}0]`)).toBe(false);
  });
});

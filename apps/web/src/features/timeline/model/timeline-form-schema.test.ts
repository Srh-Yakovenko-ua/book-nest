import { describe, expect, it } from "vitest";

import type { TimelineFormMessages } from "./timeline-form-schema";

import { buildTimelineFormSchema, timelineFormValuesToInput } from "./timeline-form-schema";

const messages: TimelineFormMessages = {
  descriptionTooLong: "description-too-long",
  nameEmpty: "name-empty",
  nameTooLong: "name-too-long",
};

function baseValues() {
  return { colorKey: "sky", description: "", name: "Флешбеки" } as const;
}

function errorFor(data: unknown, field: string) {
  const result = buildTimelineFormSchema(messages).safeParse(data);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("buildTimelineFormSchema", () => {
  it("accepts a named line", () => {
    expect(buildTimelineFormSchema(messages).safeParse(baseValues()).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(errorFor({ ...baseValues(), name: "   " }, "name")).toBe("name-empty");
  });

  it("rejects a name over the length limit", () => {
    expect(errorFor({ ...baseValues(), name: "x".repeat(101) }, "name")).toBe("name-too-long");
  });

  it("rejects a description over the length limit", () => {
    expect(errorFor({ ...baseValues(), description: "x".repeat(501) }, "description")).toBe(
      "description-too-long",
    );
  });

  it("rejects a missing color key", () => {
    expect(
      buildTimelineFormSchema(messages).safeParse({ description: "", name: "Лінія" }).success,
    ).toBe(false);
  });

  it("rejects a null color key", () => {
    expect(
      buildTimelineFormSchema(messages).safeParse({ ...baseValues(), colorKey: null }).success,
    ).toBe(false);
  });

  it("rejects a legacy color key", () => {
    expect(
      buildTimelineFormSchema(messages).safeParse({ ...baseValues(), colorKey: "blue" }).success,
    ).toBe(false);
  });
});

describe("timelineFormValuesToInput", () => {
  it("trims the name and passes the canonical color key through", () => {
    const input = timelineFormValuesToInput({
      colorKey: "lavender",
      description: "",
      name: "  Спогади  ",
    });
    expect(input.name).toBe("Спогади");
    expect(input.colorKey).toBe("lavender");
  });

  it("never emits a null color key", () => {
    expect(timelineFormValuesToInput(baseValues()).colorKey).toBe("sky");
  });

  it("converts a blank description to null", () => {
    expect(timelineFormValuesToInput(baseValues()).description).toBeNull();
  });

  it("keeps an entered description trimmed", () => {
    const input = timelineFormValuesToInput({
      colorKey: "forest",
      description: "  Паралельний сюжет  ",
      name: "Лінія",
    });
    expect(input.description).toBe("Паралельний сюжет");
  });
});

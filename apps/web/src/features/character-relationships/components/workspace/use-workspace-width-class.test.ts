import { describe, expect, it } from "vitest";

import { toPersonWidthClass, toWorkspaceWidthClass } from "./use-workspace-width-class";

describe("toPersonWidthClass", () => {
  it.each([
    { innerWidth: 639, widthClass: "compact" },
    { innerWidth: 640, widthClass: "medium" },
    { innerWidth: 1231, widthClass: "medium" },
    { innerWidth: 1232, widthClass: "wide" },
    { innerWidth: 1600, widthClass: "wide" },
  ])("classifies an inner width of $innerWidth px as $widthClass", ({ innerWidth, widthClass }) => {
    expect(toPersonWidthClass(innerWidth)).toBe(widthClass);
  });
});

describe("toWorkspaceWidthClass", () => {
  it.each([
    { width: 639, widthClass: "compact" },
    { width: 640, widthClass: "medium" },
    { width: 1179, widthClass: "medium" },
    { width: 1180, widthClass: "wide" },
    { width: 1231, widthClass: "wide" },
  ])("classifies a width of $width px as $widthClass", ({ width, widthClass }) => {
    expect(toWorkspaceWidthClass(width)).toBe(widthClass);
  });
});

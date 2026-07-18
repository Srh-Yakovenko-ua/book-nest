import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { ReadingActivityRangeControl } from "./reading-activity-range-control";

describe("ReadingActivityRangeControl", () => {
  it("marks the active range as selected", () => {
    renderWithProviders(<ReadingActivityRangeControl onValueChange={vi.fn()} value="14d" />);

    expect(screen.getByRole("radio", { name: "14 днів" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "7 днів" })).toHaveAttribute("aria-checked", "false");
  });

  it("emits the chosen range when another option is selected", async () => {
    const onValueChange = vi.fn();
    renderWithProviders(<ReadingActivityRangeControl onValueChange={onValueChange} value="7d" />);

    await userEvent.click(screen.getByRole("radio", { name: "Увесь період" }));

    expect(onValueChange).toHaveBeenCalledWith("all");
  });
});

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { render, screen, userEvent } from "@/test-utils";

import { ChipGroup } from "./chip-group";

describe("ChipGroup", () => {
  it("draws a zero count and omits a missing one", () => {
    render(
      <ChipGroup
        label="Filter"
        mode="single"
        onValueChange={() => {}}
        options={[
          { count: 4, label: "All", value: "all" },
          { count: 0, label: "Unread", value: "unread" },
          { label: "Loading", value: "loading" },
        ]}
        value="all"
      />,
    );

    expect(screen.getByRole("radio", { name: "All 4" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Unread 0" })).toBeEnabled();
    expect(screen.getByRole("radio", { name: "Loading" })).toHaveTextContent(/^Loading$/);
  });

  it("lets a zero-count chip be chosen", async () => {
    const onValueChange = vi.fn();
    render(
      <ChipGroup
        label="Filter"
        mode="single"
        onValueChange={onValueChange}
        options={[
          { count: 4, label: "All", value: "all" },
          { count: 0, label: "Unread", value: "unread" },
        ]}
        value="all"
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Unread 0" }));

    expect(onValueChange).toHaveBeenCalledWith("unread");
  });
});

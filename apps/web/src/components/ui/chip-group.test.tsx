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

  it("reserves the counter slot while counts are pending", () => {
    const { rerender } = render(
      <ChipGroup
        countsPending
        label="Filter"
        mode="single"
        onValueChange={() => {}}
        options={[{ label: "All", value: "all" }]}
        value="all"
      />,
    );

    const placeholder = screen
      .getByRole("radio", { name: "All" })
      .querySelector("[data-slot='chip-count-pending']");
    expect(placeholder).toBeInTheDocument();

    rerender(
      <ChipGroup
        countsPending={false}
        label="Filter"
        mode="single"
        onValueChange={() => {}}
        options={[{ count: 12, label: "All", value: "all" }]}
        value="all"
      />,
    );

    expect(screen.getByRole("radio", { name: "All 12" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot='chip-count-pending']")).not.toBeInTheDocument();
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

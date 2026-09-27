import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { TagChip } from "./tag-chip";

describe("TagChip", () => {
  it("paints the capsule in the tag color with a hash before the name and no border", () => {
    renderWithProviders(<TagChip color="lavender" name="вампіри" />);

    const chip = screen.getByText("вампіри").parentElement;
    if (chip === null) throw new Error("no chip");
    expect(chip.style.backgroundColor).toBe("var(--tag-lavender)");
    expect(chip.style.color).toBe("var(--tag-lavender-foreground)");
    expect(chip).toHaveClass("rounded-full");
    expect(chip).not.toHaveClass("border");
    expect(chip.querySelector("use")).toHaveAttribute("href", "/icons/ui-icons.svg#i-hash");
  });

  it("truncates a long name instead of wrapping it", () => {
    renderWithProviders(<TagChip color="sky" name="декілька хронологічних ліній" />);

    expect(screen.getByText("декілька хронологічних ліній")).toHaveClass("truncate");
  });

  it("renders as a list item when it sits in a tag list", () => {
    renderWithProviders(
      <ul>
        <TagChip as="li" color="rose" name="від ворогів до коханців" />
      </ul>,
    );

    expect(screen.getByRole("listitem")).toHaveTextContent("від ворогів до коханців");
  });
});

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { FacetMultiselect } from "./facet-multiselect";

function renderMultiselect(value: string[]) {
  renderWithProviders(
    <FacetMultiselect
      emptyText="Нічого не знайдено"
      label="Автори"
      onValueChange={vi.fn()}
      options={[
        { count: 3, label: "Френк Герберт", value: "author-1" },
        { count: 1, label: "Урсула Ле Гуїн", value: "author-2" },
      ]}
      placeholder="Усі автори"
      searchPlaceholder="Пошук автора"
      selectedText={(count) => `Обрано: ${count}`}
      value={value}
    />,
  );
}

describe("FacetMultiselect", () => {
  it("names the trigger by its label and the current selection", () => {
    renderMultiselect(["author-1", "author-2"]);

    expect(screen.getByRole("button", { name: "Автори Обрано: 2" })).toBeInTheDocument();
  });

  it("names the trigger by its label and the placeholder when nothing is selected", () => {
    renderMultiselect([]);

    expect(screen.getByRole("button", { name: "Автори Усі автори" })).toBeInTheDocument();
  });

  it("labels the option list with the facet instead of a generic name", async () => {
    renderMultiselect([]);

    await userEvent.click(screen.getByRole("button", { name: /^Автори/ }));

    expect(await screen.findByRole("listbox", { name: "Автори" })).toBeInTheDocument();
  });
});

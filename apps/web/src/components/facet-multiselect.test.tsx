import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { FacetMultiselect } from "./facet-multiselect";

type RenderOptions = {
  onValueChange?: (next: string[]) => void;
  resolveLabel?: (value: string) => string | undefined;
  value: string[];
};

function renderMultiselect({ onValueChange = vi.fn(), resolveLabel, value }: RenderOptions) {
  renderWithProviders(
    <FacetMultiselect
      emptyText="Нічого не знайдено"
      label="Автори"
      onValueChange={onValueChange}
      options={[
        { count: 3, label: "Френк Герберт", value: "author-1" },
        { count: 2, label: "Урсула Ле Гуїн", value: "author-2" },
        { count: 1, label: "Террі Пратчетт", value: "author-3" },
      ]}
      placeholder="Усі автори"
      resolveLabel={resolveLabel}
      searchPlaceholder="Пошук автора"
      selectedText={(count) => `Обрано: ${count}`}
      value={value}
    />,
  );
}

describe("FacetMultiselect", () => {
  it("names the trigger by its label and the count when several values are selected", () => {
    renderMultiselect({ value: ["author-1", "author-2"] });

    expect(screen.getByRole("button", { name: "Автори Обрано: 2" })).toBeInTheDocument();
  });

  it("names the trigger by the option label when exactly one value is selected", () => {
    renderMultiselect({ value: ["author-3"] });

    expect(screen.getByRole("button", { name: "Автори Террі Пратчетт" })).toBeInTheDocument();
  });

  it("names the trigger by its label and the placeholder when nothing is selected", () => {
    renderMultiselect({ value: [] });

    expect(screen.getByRole("button", { name: "Автори Усі автори" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Автори" })).not.toBeInTheDocument();
  });

  it("renders a chip per selected value and removes only that value on its button", async () => {
    const onValueChange = vi.fn();
    renderMultiselect({ onValueChange, value: ["author-1", "author-3"] });

    const chips = within(screen.getByRole("list", { name: "Автори" })).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Френк Герберт", "Террі Пратчетт"]);

    await userEvent.click(screen.getByRole("button", { name: "Прибрати Френк Герберт" }));

    expect(onValueChange).toHaveBeenCalledWith(["author-3"]);
  });

  it("lists the selected options first, keeping the original order of the rest", async () => {
    renderMultiselect({ value: ["author-3"] });

    await userEvent.click(screen.getByRole("button", { name: /^Автори/ }));

    const listbox = await screen.findByRole("listbox", { name: "Автори" });
    expect(
      within(listbox)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Террі Пратчетт1", "Френк Герберт3", "Урсула Ле Гуїн2"]);
  });

  it("falls back to the resolver and then to the raw value for values missing from the options", () => {
    renderMultiselect({
      resolveLabel: (value) => (value === "author-9" ? "Анджей Сапковський" : undefined),
      value: ["author-9", "author-unknown"],
    });

    const chips = within(screen.getByRole("list", { name: "Автори" })).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Анджей Сапковський", "author-unknown"]);
  });

  it("uses the resolved label in the trigger for a single value missing from the options", () => {
    renderMultiselect({ resolveLabel: () => "Анджей Сапковський", value: ["author-9"] });

    expect(screen.getByRole("button", { name: "Автори Анджей Сапковський" })).toBeInTheDocument();
  });

  it("labels the option list with the facet instead of a generic name", async () => {
    renderMultiselect({ value: [] });

    await userEvent.click(screen.getByRole("button", { name: /^Автори/ }));

    expect(await screen.findByRole("listbox", { name: "Автори" })).toBeInTheDocument();
  });
});

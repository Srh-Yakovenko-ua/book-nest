import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { CountrySelect } from "./country-select";

const LABELS = {
  clear: "Очистити країну",
  empty: "Країну не знайдено",
  placeholder: "Оберіть країну",
  search: "Пошук країни",
};

function renderSelect(value: null | string, onChange = vi.fn()) {
  renderWithProviders(
    <CountrySelect id="country" labels={LABELS} onChange={onChange} value={value} />,
  );
}

describe("CountrySelect", () => {
  it("shows the placeholder and no clear button when empty", () => {
    renderSelect(null);

    expect(screen.getByRole("combobox")).toHaveTextContent("Оберіть країну");
    expect(screen.queryByRole("button", { name: "Очистити країну" })).not.toBeInTheDocument();
  });

  it("labels the selected code with its localized country name", () => {
    renderSelect("UA");

    expect(screen.getByRole("combobox")).toHaveTextContent("Україна");
  });

  it("filters countries by localized name and selects the ISO code", async () => {
    const onChange = vi.fn();
    renderSelect(null, onChange);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText("Пошук країни"), "Польща");

    expect(screen.queryByRole("option", { name: "Україна" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("option", { name: "Польща" }));

    expect(onChange).toHaveBeenCalledWith("PL");
  });

  it("shows the empty message when nothing matches", async () => {
    renderSelect(null);

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.type(screen.getByPlaceholderText("Пошук країни"), "Атлантида");

    expect(await screen.findByText("Країну не знайдено")).toBeInTheDocument();
  });

  it("clears the value to null", async () => {
    const onChange = vi.fn();
    renderSelect("UA", onChange);

    await userEvent.click(screen.getByRole("button", { name: "Очистити країну" }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

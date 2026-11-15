import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { ThemePicker } from "./theme-picker";

const themePicker = messages.themePicker;

describe("ThemePicker", () => {
  it("names its trigger in the active locale", () => {
    renderWithProviders(<ThemePicker />);

    expect(screen.getByRole("button", { name: themePicker.ariaLabel })).toBeInTheDocument();
  });

  it("lists the theme options in the active locale", async () => {
    renderWithProviders(<ThemePicker />);

    await userEvent.click(screen.getByRole("button", { name: themePicker.ariaLabel }));

    expect(
      await screen.findByRole("menuitem", { name: themePicker.options.light }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: themePicker.options.dark })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: themePicker.options.system })).toBeInTheDocument();
  });
});

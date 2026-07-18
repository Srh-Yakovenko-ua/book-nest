import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { render, screen, userEvent } from "@/test-utils";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const CLEAR_LABEL = "Очистити";
const PLACEHOLDER = "Оберіть жанр";

function ClearableGenreSelect() {
  const [value, setValue] = useState<null | string>("fantasy");

  return (
    <Select onValueChange={setValue} value={value ?? ""}>
      <SelectTrigger
        clearLabel={CLEAR_LABEL}
        isClearable={value !== null}
        onClear={() => setValue(null)}
      >
        <SelectValue placeholder={PLACEHOLDER} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="fantasy">Фентезі</SelectItem>
        <SelectItem value="mystery">Детектив</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("SelectTrigger clear button", () => {
  it("moves focus to the trigger after clearing with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ClearableGenreSelect />);

    const clearButton = screen.getByRole("button", { name: CLEAR_LABEL });
    clearButton.focus();
    expect(document.activeElement).toBe(clearButton);

    await user.keyboard("{Enter}");

    expect(screen.queryByRole("button", { name: CLEAR_LABEL })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("combobox"));
  });

  it("does not open the listbox when the clear button is activated", async () => {
    const user = userEvent.setup();
    render(<ClearableGenreSelect />);

    await user.click(screen.getByRole("button", { name: CLEAR_LABEL }));

    expect(screen.getByRole("combobox")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

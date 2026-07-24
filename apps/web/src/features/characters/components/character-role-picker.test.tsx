import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { ROLE_TYPE_OPTIONS } from "../model/character-options";
import { CharacterRolePicker } from "./character-role-picker";

beforeAll(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("CharacterRolePicker", () => {
  it("offers the book role types without any narrator or point-of-view option", async () => {
    renderWithProviders(
      <CharacterRolePicker
        onChange={vi.fn()}
        value={[{ customRole: "", isSpoiler: false, roleType: "supporting" }]}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Роль" }));

    expect(await screen.findByRole("option", { name: "Протагоніст" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(ROLE_TYPE_OPTIONS.length);
    expect(screen.queryByRole("option", { name: /наратор/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /POV/i })).not.toBeInTheDocument();
  });
});

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { makeCharacterSummary } from "../model/characters.fixtures";
import { CharacterCard } from "./character-card";

function renderCard(character: ReturnType<typeof makeCharacterSummary>) {
  return renderWithProviders(
    <CharacterCard
      character={character}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      onOpenDetails={vi.fn()}
      onUnlink={vi.fn()}
    />,
  );
}

describe("CharacterCard unspecified semantics", () => {
  it("renders no importance badge when importance is not specified", () => {
    renderCard(makeCharacterSummary({ importance: "not_specified" }));

    expect(screen.getByRole("heading", { name: "Ґеральт" })).toBeInTheDocument();
    expect(screen.queryByText("Не вказано")).not.toBeInTheDocument();
    expect(screen.queryByText("Другорядний")).not.toBeInTheDocument();
  });

  it("renders the importance badge for an explicit importance", () => {
    renderCard(makeCharacterSummary({ importance: "central" }));

    expect(screen.getByText("Центральний")).toBeInTheDocument();
  });

  it("renders no status badge when status is not specified", () => {
    renderCard(makeCharacterSummary({ importance: "central", status: "not_specified" }));

    expect(screen.queryByText("Не вказано")).not.toBeInTheDocument();
  });

  it("renders an explicit unknown status as Невідомо", () => {
    renderCard(makeCharacterSummary({ status: "unknown" }));

    expect(screen.getByText("Невідомо")).toBeInTheDocument();
  });
});

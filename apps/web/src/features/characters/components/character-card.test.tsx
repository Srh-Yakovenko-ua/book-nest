import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeCharacterSummary } from "../model/characters.fixtures";
import { CharacterCard } from "./character-card";

function renderCard(
  character: ReturnType<typeof makeCharacterSummary>,
  handlers: Partial<{ onEdit: () => void; onOpenDetails: () => void; onUnlink: () => void }> = {},
) {
  return renderWithProviders(
    <CharacterCard
      bookId="book-1"
      character={character}
      onEdit={handlers.onEdit ?? vi.fn()}
      onOpenDetails={handlers.onOpenDetails ?? vi.fn()}
      onUnlink={handlers.onUnlink ?? vi.fn()}
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

describe("CharacterCard roster affordances", () => {
  it("shows a POV badge only for a point-of-view character", () => {
    renderCard(makeCharacterSummary({ isPovCharacter: false }));
    expect(screen.queryByText("POV")).not.toBeInTheDocument();

    renderCard(makeCharacterSummary({ characterId: "char-2", isPovCharacter: true }));
    expect(screen.getByText("POV")).toBeInTheDocument();
  });

  it("opens details from the card body", async () => {
    const onOpenDetails = vi.fn();
    renderCard(makeCharacterSummary(), { onOpenDetails });

    await userEvent.click(screen.getByRole("button", { name: "Відкрити персонажа Ґеральт" }));

    expect(onOpenDetails).toHaveBeenCalledOnce();
  });

  it("offers only edit and unlink in the overflow menu", async () => {
    renderCard(makeCharacterSummary());

    await userEvent.click(screen.getByRole("button", { name: "Дії з персонажем" }));

    expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Прибрати з цієї книги" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });
});

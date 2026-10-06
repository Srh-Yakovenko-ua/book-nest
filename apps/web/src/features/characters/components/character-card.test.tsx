import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { makeCharacterSummary } from "../model/characters.fixtures";
import { CharacterCard } from "./character-card";

function renderCard(
  character: ReturnType<typeof makeCharacterSummary>,
  handlers: Partial<{ onUnlink: () => void }> = {},
) {
  return renderWithProviders(
    <CharacterCard bookId="book-1" character={character} onUnlink={handlers.onUnlink ?? vi.fn()} />,
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

  it("links the card body to the character page in this book context", () => {
    renderCard(makeCharacterSummary({ characterId: "char-9" }));

    expect(screen.getByRole("link", { name: "Ґеральт" })).toHaveAttribute(
      "href",
      "/characters/char-9?bookId=book-1",
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("offers only edit and unlink in the overflow menu", async () => {
    renderCard(makeCharacterSummary());

    await userEvent.click(screen.getByRole("button", { name: "Дії з персонажем" }));

    expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toHaveAttribute(
      "href",
      "/characters/char-1/edit?bookId=book-1",
    );
    expect(screen.getByRole("menuitem", { name: "Прибрати з цієї книги" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
  });
});

describe("CharacterCard favorite and names", () => {
  it.each([
    { isFavorite: false, label: "Додати в улюблені", pressed: "false" },
    { isFavorite: true, label: "Прибрати з улюблених", pressed: "true" },
  ])(
    "reports aria-pressed $pressed on the favorite button when isFavorite is $isFavorite",
    ({ isFavorite, label, pressed }) => {
      renderCard(makeCharacterSummary({ isFavorite }));

      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", pressed);
    },
  );

  it("shows the global name as a secondary line when the book display name differs", () => {
    renderCard(makeCharacterSummary({ displayName: "Біловолосий", name: "Ґеральт" }));

    expect(screen.getByRole("heading", { name: "Біловолосий" })).toBeInTheDocument();
    expect(screen.getAllByText("Ґеральт")).toHaveLength(1);
    expect(screen.getByText("Ґеральт")).toBeVisible();
  });

  it.each([
    { displayName: null, situation: "there is no display name" },
    { displayName: "Ґеральт", situation: "the display name equals the global name" },
  ])("shows the name exactly once when $situation", ({ displayName }) => {
    renderCard(makeCharacterSummary({ displayName, name: "Ґеральт" }));

    expect(screen.getAllByText("Ґеральт")).toHaveLength(1);
  });
});

describe("CharacterCard hidden fields", () => {
  it("shows the hidden-fields badge with the metadata, not beside the action buttons", () => {
    renderCard(makeCharacterSummary({ hiddenFields: ["description", "status"] }));

    const badge = screen.getByText("Приховані поля: 2");

    expect(screen.getByText("Центральний").parentElement).toContainElement(badge);
    expect(
      screen.getByRole("button", { name: "Додати в улюблені" }).parentElement,
    ).not.toContainElement(badge);
  });
});

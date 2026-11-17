import "@testing-library/jest-dom/vitest";
import type { CharacterFactView } from "@app/shared";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { CharacterFactCard } from "./character-fact-card";

const LAYOUT_METRICS = ["clientHeight", "scrollHeight"] as const;

const BOX_HEIGHT_PX = 100;

afterEach(() => {
  for (const metric of LAYOUT_METRICS) Reflect.deleteProperty(HTMLElement.prototype, metric);
});

function card(): HTMLElement {
  return screen.getByRole("article");
}

function makeFact(overrides: Partial<CharacterFactView> = {}): CharacterFactView {
  return {
    chapter: "Розділ 3. Вежа ластівки",
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "fact-1",
    page: 42,
    text: "Носить два мечі: сталевий для людей і срібний для чудовиськ.",
    title: "Два мечі",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderCard(fact: CharacterFactView) {
  const onDelete = vi.fn();
  const onEdit = vi.fn();
  renderWithProviders(<CharacterFactCard fact={fact} onDelete={onDelete} onEdit={onEdit} />);
  return { onDelete, onEdit };
}

function stubOverflow(overflowingText: string, overflowPx: number) {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => BOX_HEIGHT_PX,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent === overflowingText ? BOX_HEIGHT_PX + overflowPx : BOX_HEIGHT_PX;
    },
  });
}

describe("CharacterFactCard", () => {
  it("shows the title and the text of the fact", () => {
    renderCard(makeFact());

    expect(within(card()).getByRole("heading", { level: 3, name: "Два мечі" })).toBeInTheDocument();
    expect(
      within(card()).getByText("Носить два мечі: сталевий для людей і срібний для чудовиськ."),
    ).toBeInTheDocument();
  });

  it("names both the chapter and the page when both are known", () => {
    renderCard(makeFact());

    expect(within(card()).getByText("Розділ 3. Вежа ластівки")).toBeInTheDocument();
    expect(within(card()).getByText("стор. 42")).toBeInTheDocument();
  });

  it("names only the chapter when the page is unknown", () => {
    renderCard(makeFact({ page: null }));

    expect(within(card()).getByText("Розділ 3. Вежа ластівки")).toBeInTheDocument();
    expect(within(card()).queryByText(/стор\./)).not.toBeInTheDocument();
  });

  it("names only the page when the chapter is unknown", () => {
    renderCard(makeFact({ chapter: null }));

    expect(within(card()).getByText("стор. 42")).toBeInTheDocument();
    expect(within(card()).queryByText(/Розділ/)).not.toBeInTheDocument();
  });

  it("renders nothing beyond the title and the text without a chapter or a page", () => {
    renderCard(makeFact({ chapter: null, page: null }));

    expect(card().textContent).toBe(
      "Два мечіНосить два мечі: сталевий для людей і срібний для чудовиськ.",
    );
  });

  it("offers only the title and the actions menu named after the fact when nothing is clamped", () => {
    renderCard(makeFact());

    expect(within(card()).getAllByRole("button")).toHaveLength(2);
    expect(within(card()).getByRole("button", { name: "Два мечі" })).toBeInTheDocument();
    expect(
      within(card()).getByRole("button", { name: "Дії з фактом «Два мечі»" }),
    ).toBeInTheDocument();
    expect(
      within(card()).queryByRole("button", { name: "Читати повністю" }),
    ).not.toBeInTheDocument();
  });

  it("edits the fact from its actions menu without opening the full view", async () => {
    const fact = makeFact();
    const { onEdit } = renderCard(fact);
    const menu = within(card()).getByRole("button", { name: "Дії з фактом «Два мечі»" });

    await userEvent.click(menu);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати" }));

    expect(onEdit).toHaveBeenCalledExactlyOnceWith(fact, menu);
    expect(screen.queryByRole("dialog", { name: "Два мечі" })).not.toBeInTheDocument();
  });

  it("deletes the fact from its actions menu without opening the full view", async () => {
    const fact = makeFact();
    const { onDelete } = renderCard(fact);
    const menu = within(card()).getByRole("button", { name: "Дії з фактом «Два мечі»" });

    await userEvent.click(menu);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));

    expect(onDelete).toHaveBeenCalledExactlyOnceWith(fact, menu);
    expect(screen.queryByRole("dialog", { name: "Два мечі" })).not.toBeInTheDocument();
  });
});

describe("CharacterFactCard full view", () => {
  it("offers to read the whole fact when its text is cut off", () => {
    const fact = makeFact();
    stubOverflow(fact.text, 60);

    renderCard(fact);

    expect(within(card()).getByRole("button", { name: "Читати повністю" })).toBeInTheDocument();
  });

  it("offers to read the whole fact when only its title is cut off", () => {
    const fact = makeFact();
    stubOverflow(fact.title, 60);

    renderCard(fact);

    expect(within(card()).getByRole("button", { name: "Читати повністю" })).toBeInTheDocument();
  });

  it("offers no full view when the text overflows by no more than a pixel", () => {
    const fact = makeFact();
    stubOverflow(fact.text, 1);

    renderCard(fact);

    expect(
      within(card()).queryByRole("button", { name: "Читати повністю" }),
    ).not.toBeInTheDocument();
  });

  it("opens the whole fact in a dialog named after it", async () => {
    const fact = makeFact();
    stubOverflow(fact.text, 60);
    renderCard(fact);

    await userEvent.click(within(card()).getByRole("button", { name: "Читати повністю" }));

    const dialog = await screen.findByRole("dialog", { name: "Два мечі" });
    expect(within(dialog).getByRole("region", { name: "Повний текст факту" })).toHaveTextContent(
      "Носить два мечі: сталевий для людей і срібний для чудовиськ.",
    );
  });

  it("returns focus to the read-more button when the full view closes", async () => {
    const fact = makeFact();
    stubOverflow(fact.text, 60);
    renderCard(fact);
    const readMore = within(card()).getByRole("button", { name: "Читати повністю" });
    await userEvent.click(readMore);
    await screen.findByRole("dialog", { name: "Два мечі" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(readMore).toHaveFocus();
  });

  it("opens the whole fact from its title even when nothing is cut off", async () => {
    renderCard(makeFact());

    await userEvent.click(within(card()).getByRole("button", { name: "Два мечі" }));

    const dialog = await screen.findByRole("dialog", { name: "Два мечі" });
    expect(within(dialog).getByRole("region", { name: "Повний текст факту" })).toHaveTextContent(
      "Носить два мечі: сталевий для людей і срібний для чудовиськ.",
    );
  });

  it("returns focus to the title when the full view opened from it closes", async () => {
    renderCard(makeFact());
    const title = within(card()).getByRole("button", { name: "Два мечі" });
    await userEvent.click(title);
    await screen.findByRole("dialog", { name: "Два мечі" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(title).toHaveFocus();
  });
});

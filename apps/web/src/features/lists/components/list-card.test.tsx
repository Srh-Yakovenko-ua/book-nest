import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeCustomListCard, makeMediaView } from "../model/lists.fixtures";
import { ListCard } from "./list-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function renderCard(overrides = {}, handlers = {}) {
  return renderWithProviders(
    <ListCard
      list={makeCustomListCard(overrides)}
      onDelete={vi.fn()}
      onEdit={vi.fn()}
      {...handlers}
    />,
  );
}

describe("ListCard", () => {
  it("links to the list detail page from its name", () => {
    renderCard({ id: "list-42", name: "Осіннє читання" });

    expect(screen.getByRole("link", { name: "Осіннє читання" })).toHaveAttribute(
      "href",
      "/lists/list-42",
    );
  });

  it("shows the description when present", () => {
    renderCard({ description: "Затишні книги для холодних вечорів" });

    expect(screen.getByRole("paragraph")).toHaveTextContent("Затишні книги для холодних вечорів");
  });

  it("renders no description paragraph when the list has none", () => {
    renderCard({ description: null });

    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("renders no description paragraph when the description is only whitespace", () => {
    renderCard({ description: "   " });

    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
  });

  it("shows the pluralised book count", () => {
    renderCard({ bookCount: 3 });

    expect(screen.getByText("3 книги")).toBeInTheDocument();
  });

  it("renders the empty placeholder and no covers for a list without books", () => {
    renderCard({ bookCount: 0, previewCovers: [] });

    expect(screen.getByText("У списку ще немає книг")).toBeInTheDocument();
    expect(screen.getByText("0 книг")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders a cover image for each preview cover", () => {
    renderCard({
      bookCount: 2,
      name: "Детективи",
      previewCovers: [makeMediaView({ id: "cover-1" }), makeMediaView({ id: "cover-2" })],
    });

    expect(screen.getAllByAltText("Обкладинка зі списку Детективи")).toHaveLength(2);
  });

  it("invokes onEdit when the edit menu action is chosen", async () => {
    const onEdit = vi.fn();
    renderCard({ name: "Детективи" }, { onEdit });

    await userEvent.click(screen.getByRole("button", { name: "Дії списку: Детективи" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Редагувати" }));

    expect(onEdit).toHaveBeenCalledOnce();
  });

  it("invokes onDelete when the delete menu action is chosen", async () => {
    const onDelete = vi.fn();
    renderCard({ name: "Детективи" }, { onDelete });

    await userEvent.click(screen.getByRole("button", { name: "Дії списку: Детективи" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Видалити" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});

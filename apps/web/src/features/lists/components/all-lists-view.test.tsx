import "@testing-library/jest-dom/vitest";

import type { CustomListCard } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeCustomListCard } from "../model/lists.fixtures";
import { AllListsView } from "./all-lists-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

type ViewProps = Parameters<typeof AllListsView>[0];

function renderView(overrides: Partial<ViewProps> = {}) {
  const props: ViewProps = {
    hasActiveFilters: false,
    hasAnyLists: true,
    isError: false,
    isPending: false,
    lists: [makeCustomListCard()],
    onClearFilters: vi.fn(),
    onCreateList: vi.fn(),
    onDeleteList: vi.fn(),
    onEditList: vi.fn(),
    onOpenLibrary: vi.fn(),
    onRetry: vi.fn(),
    sidebar: <div>SIDEBAR</div>,
    summary: <div>SUMMARY</div>,
    toolbar: <div>TOOLBAR</div>,
    ...overrides,
  };
  return renderWithProviders(<AllListsView {...props} />);
}

describe("AllListsView", () => {
  it("renders the lists as cards in the given order", () => {
    const lists: CustomListCard[] = [
      makeCustomListCard({ id: "a", name: "Альфа" }),
      makeCustomListCard({ id: "b", name: "Бета" }),
    ];
    renderView({ lists });

    const links = screen.getAllByRole("link", { name: /Альфа|Бета/ });
    expect(links.map((link) => link.textContent)).toEqual(["Альфа", "Бета"]);
  });

  it("shows the toolbar and sidebar once lists are loaded", () => {
    renderView();

    expect(screen.getByText("TOOLBAR")).toBeInTheDocument();
    expect(screen.getByText("SIDEBAR")).toBeInTheDocument();
  });

  it("triggers list creation from the header action", async () => {
    const onCreateList = vi.fn();
    renderView({ onCreateList });

    await userEvent.click(screen.getByRole("button", { name: "Створити список" }));

    expect(onCreateList).toHaveBeenCalledOnce();
  });

  it("shows a busy skeleton while lists are loading", () => {
    renderView({ isPending: true, lists: [] });

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.queryByText("Створи першу тематичну добірку")).not.toBeInTheDocument();
  });

  it("shows an error alert with a retry action and hides the toolbar", async () => {
    const onRetry = vi.fn();
    renderView({ isError: true, lists: [], onRetry });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити списки")).toBeInTheDocument();
    expect(screen.queryByText("TOOLBAR")).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("offers create and library actions when there are no lists at all", async () => {
    const onOpenLibrary = vi.fn();
    renderView({ hasAnyLists: false, lists: [], onOpenLibrary });

    expect(screen.getByText("Створи першу тематичну добірку")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Створити список" })).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Перейти до всіх книг" }));

    expect(onOpenLibrary).toHaveBeenCalledOnce();
  });

  it("offers to clear the filters when nothing matches", async () => {
    const onClearFilters = vi.fn();
    renderView({ hasActiveFilters: true, hasAnyLists: true, lists: [], onClearFilters });

    expect(screen.getByText("Нічого не знайдено")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Скинути фільтри" }));

    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it("shows the summary cards once lists are loaded and hides them on error", () => {
    const { unmount } = renderView();
    expect(screen.getByText("SUMMARY")).toBeInTheDocument();
    unmount();

    renderView({ isError: true, lists: [] });
    expect(screen.queryByText("SUMMARY")).not.toBeInTheDocument();
  });
});

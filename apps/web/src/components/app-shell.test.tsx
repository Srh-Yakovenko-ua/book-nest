import "@testing-library/jest-dom/vitest";

import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { AppSidebar } from "./app-shell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const GROUP_LABEL_SELECTOR = '[data-slot="sidebar-group-label"]';

const NAV_GROUP_LABELS = ["Книги", "Каталог", "Записи", "Облік"];

function activeLabels(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent ?? "");
}

function groupLabels(): string[] {
  return screen
    .getAllByText(/\S/, { selector: GROUP_LABEL_SELECTOR })
    .map((label) => label.textContent ?? "");
}

function renderSidebar({ open = true, pathname = "/" } = {}) {
  navigation.pathname = pathname;

  return renderWithProviders(
    <SidebarProvider defaultOpen={open}>
      <SidebarTrigger />
      <AppSidebar />
    </SidebarProvider>,
  );
}

function stubViewportWidth(width: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: vi.fn(),
    matches: width < 1024,
    media,
    removeEventListener: vi.fn(),
  }));
}

function subItemOf(link: HTMLElement): HTMLLIElement {
  const item = link.closest("li");
  if (item === null) throw new Error(`no list item around ${link.textContent}`);
  return item;
}

afterEach(() => {
  vi.unstubAllGlobals();
  navigation.pathname = "/";
});

describe("AppSidebar", () => {
  it("links the global characters catalog", () => {
    renderSidebar();

    expect(screen.getByRole("link", { name: "Персонажі" })).toHaveAttribute("href", "/characters");
  });

  it("renders the semantic navigation groups", () => {
    renderSidebar();

    expect(groupLabels()).toEqual(NAV_GROUP_LABELS);
  });

  it("names every navigation group list for assistive tech", () => {
    renderSidebar();

    for (const name of NAV_GROUP_LABELS) {
      expect(screen.getByRole("list", { name })).toBeInTheDocument();
    }
  });

  it("marks only home as active on the home route", () => {
    renderSidebar({ pathname: "/" });

    expect(activeLabels()).toEqual(["Головна"]);
  });

  it("keeps a catalog item active on a detail route", () => {
    renderSidebar({ pathname: "/characters/c1/edit" });

    expect(activeLabels()).toEqual(["Персонажі"]);
  });

  it("keeps publishers active on a publisher detail route", () => {
    renderSidebar({ pathname: "/publishers/p1" });

    expect(activeLabels()).toEqual(["Видавництва"]);
  });

  it("does not light up all books on the wishlist route", () => {
    renderSidebar({ pathname: "/books-to-buy" });

    expect(activeLabels()).toEqual(["Список бажань"]);
  });

  it("pins settings to the footer", () => {
    renderSidebar({ pathname: "/settings" });

    const settings = screen.getByRole("link", { name: "Налаштування" });

    expect(settings.closest('[data-slot="sidebar-footer"]')).not.toBeNull();
    expect(settings).toHaveAttribute("aria-current", "page");
  });

  it("expands a section into its children without child icons", async () => {
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: "Позичені книги" }));

    const children = [
      ["Треба повернути", "/loans/borrowed"],
      ["Передано іншим", "/loans/lent"],
      ["Історія позик", "/loans/history"],
      ["Контакти", "/loans/contacts"],
    ] as const;

    for (const [name, href] of children) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(subItemOf(link).querySelectorAll("svg")).toHaveLength(0);
    }
  });

  it("opens the matching section and marks the active child", () => {
    renderSidebar({ pathname: "/delivery/history" });

    const child = screen.getByRole("link", { name: "Історія" });

    expect(child).toHaveAttribute("href", "/delivery/history");
    expect(child).toHaveAttribute("aria-current", "page");
    expect(subItemOf(child).querySelectorAll("svg")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "В дорозі" })).not.toHaveAttribute("aria-current");
  });

  it("marks an active section on its expanded trigger without claiming the page", () => {
    renderSidebar({ pathname: "/loans/lent" });

    const trigger = screen.getByRole("button", { name: "Позичені книги" });

    expect(trigger).toHaveAttribute("data-active", "true");
    expect(trigger).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Доставки" })).toHaveAttribute(
      "data-active",
      "false",
    );
  });

  it("never turns a collapsed section into a link to its first child", () => {
    renderSidebar({ open: false });

    expect(screen.getByRole("button", { name: "Позичені книги" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Позичені книги" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Треба повернути" })).not.toBeInTheDocument();
  });

  it("opens a flyout for a collapsed section", async () => {
    renderSidebar({ open: false, pathname: "/loans/lent" });

    await userEvent.click(screen.getByRole("button", { name: "Позичені книги" }));

    const flyout = await screen.findByRole("menu");

    expect(within(flyout).getByText("Позичені книги")).toBeInTheDocument();
    expect(within(flyout).getByRole("menuitem", { name: "Треба повернути" })).toHaveAttribute(
      "href",
      "/loans/borrowed",
    );
    expect(within(flyout).getByRole("menuitem", { name: "Передано іншим" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps the full navigation in the mobile sheet", async () => {
    stubViewportWidth(500);
    renderSidebar();

    await userEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(groupLabels()).toEqual(NAV_GROUP_LABELS);
    expect(screen.getByRole("link", { name: "Персонажі" })).toHaveAttribute("href", "/characters");
    expect(screen.getByRole("link", { name: "Налаштування" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Доставки" }));

    expect(screen.getByRole("link", { name: "В дорозі" })).toHaveAttribute(
      "href",
      "/delivery/in-transit",
    );
  });
});

import "@testing-library/jest-dom/vitest";

import type { TagStatsView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { Tags } from "./tags";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const TAGS: TagStatsView[] = [
  {
    booksCount: 5,
    color: null,
    description: null,
    id: "tag-slow-burn",
    lastUsedAt: null,
    name: "slow burn",
    normalizedName: "slow burn",
    type: "trope",
  },
  {
    booksCount: 0,
    color: null,
    description: null,
    id: "tag-cozy",
    lastUsedAt: null,
    name: "cozy",
    normalizedName: "cozy",
    type: "atmosphere",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Tags page", () => {
  it("renders the standalone Tags page without a Genres tab", async () => {
    stubTagStats(TAGS);

    renderWithProviders(<Tags />);

    expect(screen.getByRole("heading", { level: 1, name: "Теги" })).toBeInTheDocument();
    expect(await screen.findAllByText("slow burn")).not.toHaveLength(0);
    expect(screen.queryByRole("tab", { name: "Жанри" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати тег" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Жанри додаються з книг автоматично, а теги ви можете створювати самостійно.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the local tag search", async () => {
    stubTagStats(TAGS);

    renderWithProviders(<Tags />);

    await screen.findAllByText("slow burn");
    await userEvent.type(screen.getByLabelText("Пошук тегу"), "cozy");

    expect(
      screen.queryByRole("button", { name: "Дії з тегом «slow burn»" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дії з тегом «cozy»" })).toBeInTheDocument();
  });
});

function stubTagStats(tags: TagStatsView[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const { pathname } = new URL(String(input), "http://localhost");
      if (pathname === "/api/tags/stats") {
        return Promise.resolve(
          new Response(JSON.stringify(tags), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }),
        );
      }
      return Promise.resolve(new Response("{}", { status: 404 }));
    }),
  );
}

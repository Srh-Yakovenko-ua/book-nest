import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeDedicationBook } from "../model/dedications.fixtures";
import { DedicationCard } from "./dedication-card";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const book = makeDedicationBook({
  dedication: "Моїй мамі, яка навчила мене мріяти.",
  isFavorite: false,
  isFavoriteDedication: false,
  title: "Останнє бажання",
});

const fetchMock = vi.fn();
const writeText = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function updateBody(): Record<string, unknown> {
  const call = updateCall();
  if (call === undefined) throw new Error("no PATCH call was made");
  return JSON.parse(String(call[1].body)) as Record<string, unknown>;
}

function updateCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}`) &&
      (init?.method ?? "GET").toUpperCase() === "PATCH",
  ) as [string, RequestInit] | undefined;
}

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/books/") && method === "PATCH") {
      return Promise.resolve(
        jsonResponse(makeDedicationBook({ id: book.id, isFavoriteDedication: true })),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DedicationCard", () => {
  it("shows the book title, author and dedication text", () => {
    renderWithProviders(<DedicationCard book={book} onOpen={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Останнє бажання" })).toHaveAttribute(
      "href",
      `/books/${book.id}`,
    );
    expect(screen.getByText("Анджей Сапковський")).toBeInTheDocument();
    expect(screen.getByText("Моїй мамі, яка навчила мене мріяти.")).toBeInTheDocument();
  });

  it("falls back to the unknown-author label when the book has no authors", () => {
    renderWithProviders(
      <DedicationCard book={makeDedicationBook({ authors: [] })} onOpen={vi.fn()} />,
    );

    expect(screen.getByText("Автор невідомий")).toBeInTheDocument();
  });

  it("copies the dedication text and confirms it with a toast", async () => {
    renderWithProviders(<DedicationCard book={book} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Скопіювати присвяту" }));

    expect(writeText).toHaveBeenCalledWith("Моїй мамі, яка навчила мене мріяти.");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Присвяту скопійовано"));
  });

  it("reports a blocked clipboard", async () => {
    writeText.mockRejectedValue(new Error("blocked"));
    renderWithProviders(<DedicationCard book={book} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Скопіювати присвяту" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося скопіювати присвяту"));
  });

  it("opens the reading modal when the dedication preview is activated", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<DedicationCard book={book} onOpen={onOpen} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Читати присвяту з книги «Останнє бажання»" }),
    );

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not open the modal when a card action is used", async () => {
    const onOpen = vi.fn();
    renderWithProviders(<DedicationCard book={book} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: "Скопіювати присвяту" }));

    expect(onOpen).not.toHaveBeenCalled();
  });

  it("labels the heart for the dedication, not for the book", () => {
    renderWithProviders(<DedicationCard book={book} onOpen={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Додати присвяту в улюблені" })).toBeInTheDocument();
  });

  it("marks the dedication favorite without touching the book favorite", async () => {
    renderWithProviders(<DedicationCard book={book} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Додати присвяту в улюблені" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ isFavoriteDedication: true });
    expect(updateBody()).not.toHaveProperty("isFavorite");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Додано в улюблені присвяти"));
  });

  it("unmarks a favorite dedication without touching the book favorite", async () => {
    const favorite = makeDedicationBook({ isFavorite: true, isFavoriteDedication: true });
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          makeDedicationBook({ id: favorite.id, isFavorite: true, isFavoriteDedication: false }),
        ),
      ),
    );
    renderWithProviders(<DedicationCard book={favorite} onOpen={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Прибрати присвяту з улюблених" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toEqual({ isFavoriteDedication: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Прибрано з улюблених присвят"));
  });

  it("keeps the dedication heart unfilled for a favorite book whose dedication is not favorite", () => {
    renderWithProviders(
      <DedicationCard
        book={makeDedicationBook({ isFavorite: true, isFavoriteDedication: false })}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Додати присвяту в улюблені" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("marks the heart pressed once the dedication is favorite", () => {
    renderWithProviders(
      <DedicationCard
        book={makeDedicationBook({ isFavorite: false, isFavoriteDedication: true })}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Прибрати присвяту з улюблених" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

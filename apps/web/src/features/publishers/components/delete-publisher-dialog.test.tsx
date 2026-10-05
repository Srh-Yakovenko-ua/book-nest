import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { DeletePublisherDialog } from "./delete-publisher-dialog";

const { pushMock, replaceMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fetchMock = vi.fn();

let respondToDelete: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog({ booksCount = 0, onMerge = vi.fn() } = {}) {
  return renderWithProviders(
    <DeletePublisherDialog
      booksCount={booksCount}
      onCloseAutoFocus={vi.fn()}
      onMerge={onMerge}
      onOpenChange={vi.fn()}
      open
      publisherId="publisher-1"
      publisherName="Vivat"
    />,
  );
}

beforeEach(() => {
  respondToDelete = () => new Response(null, { status: 204 });

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "DELETE") return Promise.resolve(respondToDelete());
    return Promise.reject(new Error(`unexpected ${method} ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeletePublisherDialog", () => {
  it("deletes a publisher without books and replaces the route with the list", async () => {
    renderDialog();

    expect(screen.getByText("Видалити видавництво?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Обʼєднати з іншим" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Видавництво видалено"));
    expect(replaceMock).toHaveBeenCalledWith("/publishers");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows the blocked state for a publisher with books and sends no delete request", () => {
    renderDialog({ booksCount: 3 });

    expect(screen.getByText("Видавництво не можна видалити")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Закрити" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("offers a merge instead of a dead end when books are linked", async () => {
    const onMerge = vi.fn();
    renderDialog({ booksCount: 3, onMerge });

    await userEvent.click(screen.getByRole("button", { name: "Обʼєднати з іншим" }));

    expect(onMerge).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a server PUBLISHER_HAS_BOOKS conflict to the blocked state", async () => {
    respondToDelete = () => jsonResponse({ code: "PUBLISHER_HAS_BOOKS", message: "linked" }, 409);

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    expect(await screen.findByText("Видавництво не можна видалити")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обʼєднати з іншим" })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("offers a merge when a zero-count publisher still conflicts on the server", async () => {
    respondToDelete = () => jsonResponse({ code: "PUBLISHER_HAS_BOOKS", message: "linked" }, 409);
    const onMerge = vi.fn();
    renderDialog({ onMerge });

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));
    await userEvent.click(await screen.findByRole("button", { name: "Обʼєднати з іншим" }));

    expect(onMerge).toHaveBeenCalledOnce();
  });

  it("shows a form-level error for other failures", async () => {
    respondToDelete = () => jsonResponse({ message: "boom" }, 500);

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    expect(
      await screen.findByText("Не вдалося видалити видавництво. Спробуй ще раз."),
    ).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

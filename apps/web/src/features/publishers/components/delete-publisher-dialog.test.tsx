import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { DeletePublisherDialog } from "./delete-publisher-dialog";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
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

function renderDialog() {
  return renderWithProviders(
    <DeletePublisherDialog
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
  it("deletes the publisher and returns to the list on confirm", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Видавництво видалено"));
    expect(pushMock).toHaveBeenCalledWith("/publishers");
  });

  it("explains why a publisher with linked books cannot be deleted", async () => {
    respondToDelete = () => jsonResponse({ message: "linked" }, 409);

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    expect(
      await screen.findByText(
        "Не можна видалити видавництво, до якого привʼязані книги. Спочатку відвʼяжи книги.",
      ),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

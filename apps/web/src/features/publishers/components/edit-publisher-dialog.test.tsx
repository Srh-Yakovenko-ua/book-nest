import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherDetail } from "@app/shared";
import type { ReactNode } from "react";

import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makePublisherDetail } from "../model/publisher.fixtures";
import { EditPublisherDialog } from "./edit-publisher-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fetchMock = vi.fn();

let respondToUpdate: () => Response;

function EditHarness({ details }: { details: LibraryPublisherDetail }) {
  const [open, setOpen] = useState(true);
  return <EditPublisherDialog details={details} onOpenChange={setOpen} open={open} />;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(details = makePublisherDetail({ isCustom: true, name: "Vivat" })) {
  return renderWithProviders(<EditHarness details={details} />);
}

beforeEach(() => {
  respondToUpdate = () => jsonResponse(makePublisherDetail({ isCustom: true, name: "Vivat" }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") return Promise.resolve(respondToUpdate());
    return Promise.reject(new Error(`unexpected ${method} ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditPublisherDialog", () => {
  it("prefills the form with the publisher details", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Редагувати видавництво" })).toBeInTheDocument();
    expect(screen.getByLabelText("Назва")).toHaveValue("Vivat");
  });

  it("requires a name before saving", async () => {
    renderDialog();

    await userEvent.clear(screen.getByLabelText("Назва"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Назва має містити щонайменше 2 символи")).toBeInTheDocument();
  });

  it("surfaces a duplicate name as a field error on a 409", async () => {
    respondToUpdate = () => jsonResponse({ message: "duplicate" }, 409);

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Видавництво з такою назвою вже існує")).toBeInTheDocument();
  });

  it("confirms a successful save with a toast", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Видавництво оновлено"));
  });

  it("asks to discard unsaved changes when closing a dirty form", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
  });
});

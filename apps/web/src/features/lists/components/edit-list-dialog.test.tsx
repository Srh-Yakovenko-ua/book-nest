import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeCustomListCard } from "../model/lists.fixtures";
import { EditListDialog } from "./edit-list-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToUpdate: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(listOverrides = {}, onOpenChange = vi.fn()) {
  const list = makeCustomListCard({
    description: "Затишні книги",
    name: "Осіннє читання",
    ...listOverrides,
  });
  return renderWithProviders(<EditListDialog list={list} onOpenChange={onOpenChange} open />);
}

function updateCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/lists") && (init?.method ?? "GET").toUpperCase() === "PATCH",
  ) as [string, RequestInit] | undefined;
}

beforeEach(() => {
  respondToUpdate = () => jsonResponse(makeCustomListCard());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/lists") && method === "PATCH") return Promise.resolve(respondToUpdate());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditListDialog", () => {
  it("keeps the save action disabled until something changes", () => {
    renderDialog();

    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  });

  it("enables the save action after the name is edited", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва списку"), " оновлене");

    expect(screen.getByRole("button", { name: "Зберегти" })).toBeEnabled();
  });

  it("keeps the save action disabled for a whitespace-only edit", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва списку"), "   ");

    expect(screen.getByRole("button", { name: "Зберегти" })).toBeDisabled();
  });

  it("submits the edited values and confirms with a toast", async () => {
    const onOpenChange = vi.fn();
    renderDialog({ id: "list-9" }, onOpenChange);

    await userEvent.clear(screen.getByLabelText("Назва списку"));
    await userEvent.type(screen.getByLabelText("Назва списку"), "Зимове читання");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(String(updateCall()?.[0])).toContain("/api/lists/list-9");
    expect(JSON.parse(String(updateCall()?.[1].body))).toMatchObject({ name: "Зимове читання" });
    expect(toast.success).toHaveBeenCalledWith("Список оновлено");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces a duplicate-name error when the server responds with a conflict", async () => {
    respondToUpdate = () => jsonResponse({ message: "duplicate" }, 409);
    const onOpenChange = vi.fn();
    renderDialog({}, onOpenChange);

    await userEvent.clear(screen.getByLabelText("Назва списку"));
    await userEvent.type(screen.getByLabelText("Назва списку"), "Дублікат");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Список із такою назвою вже існує")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeCustomListCard } from "../model/lists.fixtures";
import { CreateListDialog } from "./create-list-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToCreate: () => Response;

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/api/lists") && (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog(onOpenChange = vi.fn()) {
  return renderWithProviders(<CreateListDialog onOpenChange={onOpenChange} open />);
}

beforeEach(() => {
  respondToCreate = () => jsonResponse(makeCustomListCard());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/lists") && method === "POST") return Promise.resolve(respondToCreate());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CreateListDialog", () => {
  it("blocks creation and flags the field when the name is empty", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Створити список" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Назва списку")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(createCall()).toBeUndefined();
  });

  it("blocks creation when the name is shorter than two characters", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва списку"), "A");
    await userEvent.click(screen.getByRole("button", { name: "Створити список" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Назва списку")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(createCall()).toBeUndefined();
  });

  it("submits the trimmed name and description and confirms with a toast", async () => {
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await userEvent.type(screen.getByLabelText("Назва списку"), "Осіннє читання");
    await userEvent.type(screen.getByLabelText("Опис"), "Затишні книги");
    await userEvent.click(screen.getByRole("button", { name: "Створити список" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(JSON.parse(String(createCall()?.[1].body))).toEqual({
      description: "Затишні книги",
      name: "Осіннє читання",
    });
    expect(toast.success).toHaveBeenCalledWith("Список створено");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("surfaces a duplicate-name error when the server responds with a conflict", async () => {
    respondToCreate = () => jsonResponse({ message: "duplicate" }, 409);
    const onOpenChange = vi.fn();
    renderDialog(onOpenChange);

    await userEvent.type(screen.getByLabelText("Назва списку"), "Осіннє читання");
    await userEvent.click(screen.getByRole("button", { name: "Створити список" }));

    expect(await screen.findByText("Список із такою назвою вже існує")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

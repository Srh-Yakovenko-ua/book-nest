import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import {
  makeReadingPosition,
  makeTimelineEventView,
  makeTimelineView,
} from "../model/timeline.fixtures";
import { EventFormDialog } from "./event-form-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function createCall() {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes("/timeline-events") && (init?.method ?? "GET").toUpperCase() === "POST",
  ) as [string, RequestInit] | undefined;
}

function createdBody() {
  const call = createCall();
  if (call === undefined) throw new Error("no create request captured");
  return JSON.parse(String(call[1].body)) as Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderForm(props: Partial<Parameters<typeof EventFormDialog>[0]> = {}) {
  renderWithProviders(
    <EventFormDialog
      bookId="book-1"
      createTimelineId="line-1"
      onOpenChange={vi.fn()}
      open
      pagesCount={null}
      readingPosition={null}
      timelines={[makeTimelineView({ id: "line-1", name: "Основна лінія" })]}
      {...props}
    />,
  );
}

function titleField() {
  return screen.getByLabelText(/Назва події/);
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    if (String(input).includes("/timeline-events") && init?.method === "POST") {
      return Promise.resolve(jsonResponse(makeTimelineEventView()));
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EventFormDialog", () => {
  it("presents an accessible dialog and focuses the title field on open", () => {
    renderForm();

    expect(screen.getByRole("dialog", { name: "Нова подія" })).toBeInTheDocument();
    expect(titleField()).toHaveFocus();
  });

  it("keeps advanced fields hidden in quick mode", () => {
    renderForm();

    expect(screen.queryByLabelText("Розділ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Сторінка")).not.toBeInTheDocument();
  });

  it("creates an event from the title alone", async () => {
    const onOpenChange = vi.fn();
    renderForm({ onOpenChange });

    await userEvent.type(titleField(), "Геральт приймає замовлення");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти подію" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(createdBody()).toMatchObject({
      summary: null,
      timelineId: "line-1",
      title: "Геральт приймає замовлення",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("keeps typed values and prefills the page when advanced fields are revealed", async () => {
    renderForm({
      readingPosition: makeReadingPosition({ currentPage: 42, positionKnown: true }),
    });

    await userEvent.type(titleField(), "Зустріч у корчмі");
    await userEvent.type(screen.getByLabelText("Короткий опис"), "Коротко");
    await userEvent.click(screen.getByRole("button", { name: "Більше полів" }));

    expect(titleField()).toHaveValue("Зустріч у корчмі");
    expect(screen.getByLabelText("Короткий опис")).toHaveValue("Коротко");
    expect(screen.getByLabelText("Сторінка")).toHaveValue(42);
  });

  it("rejects a page beyond the known book length and links the error to the field", async () => {
    renderForm({ pagesCount: 100 });

    await userEvent.type(titleField(), "Помилкова сторінка");
    await userEvent.click(screen.getByRole("button", { name: "Більше полів" }));
    await userEvent.type(screen.getByLabelText("Сторінка"), "150");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти подію" }));

    const error = await screen.findByText("Не більше 100 сторінок у книзі");
    expect(error).toHaveAttribute("id", "event-page-error");
    expect(screen.getByLabelText("Сторінка")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Сторінка")).toHaveAttribute(
      "aria-describedby",
      "event-page-error",
    );
    expect(createCall()).toBeUndefined();
  });

  it("asks for confirmation before discarding unsaved edits", async () => {
    renderForm();

    await userEvent.type(titleField(), "Незбережене");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Закрити без збереження?");
  });

  it("preserves the form when saving fails", async () => {
    fetchMock.mockImplementation((input, init) => {
      if (String(input).includes("/timeline-events") && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ message: "boom" }, 500));
      }
      return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
    });
    const onOpenChange = vi.fn();
    renderForm({ onOpenChange });

    await userEvent.type(titleField(), "Помилкова подія");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти подію" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося додати подію"));
    expect(titleField()).toHaveValue("Помилкова подія");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("clears the form for another entry after save-and-add-another", async () => {
    const onOpenChange = vi.fn();
    renderForm({ onOpenChange });

    await userEvent.type(titleField(), "Перша подія");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти й додати ще" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    await waitFor(() => expect(titleField()).toHaveValue(""));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

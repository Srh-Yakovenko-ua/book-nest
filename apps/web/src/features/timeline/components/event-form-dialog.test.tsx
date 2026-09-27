import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import {
  makeEventsPage,
  makeReadingPosition,
  makeTimelineEventDetailView,
  makeTimelineEventPreview,
  makeTimelineEventView,
  makeTimelineView,
} from "../model/timeline.fixtures";
import { EventFormDialog } from "./event-form-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function bodyOf(call: [string, RequestInit] | undefined) {
  if (call === undefined) throw new Error("no request captured");
  return JSON.parse(String(call[1].body)) as Record<string, unknown>;
}

function callFor(predicate: (url: string, method: string) => boolean) {
  return fetchMock.mock.calls.find(([url, init]) =>
    predicate(String(url), (init?.method ?? "GET").toUpperCase()),
  ) as [string, RequestInit] | undefined;
}

function createCall() {
  return callFor(
    (url, method) => url.includes("/books/book-1/timeline-events") && method === "POST",
  );
}

function expandSection(name: RegExp) {
  return userEvent.click(screen.getByRole("button", { name }));
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function relationCall() {
  return callFor((url, method) => url.includes("/relations") && method === "POST");
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

function routeFetch({
  detail,
  listItems = [],
}: {
  detail?: unknown;
  listItems?: ReturnType<typeof makeTimelineEventView>[];
} = {}) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/relations") && method === "POST") {
      return Promise.resolve(
        jsonResponse({
          createdAt: "2026-01-01T00:00:00.000Z",
          id: "relation-1",
          relationType: "related",
          sourceEventId: "event-1",
          target: makeTimelineEventPreview({ id: "event-7" }),
          targetEventId: "event-7",
        }),
      );
    }
    if (url.includes("/books/book-1/timeline-events")) {
      if (method === "POST") return Promise.resolve(jsonResponse(makeTimelineEventView()));
      return Promise.resolve(jsonResponse(makeEventsPage(listItems)));
    }
    if (/\/api\/timeline-events\/[^/?]+$/.test(url)) {
      if (method === "PATCH") return Promise.resolve(jsonResponse(makeTimelineEventView()));
      if (detail !== undefined) return Promise.resolve(jsonResponse(detail));
    }
    return Promise.reject(new Error(`unexpected fetch: ${method} ${url}`));
  });
}

function titleField() {
  return screen.getByLabelText(/Назва події/);
}

function updateCall() {
  return callFor(
    (url, method) => /\/api\/timeline-events\/[^/?]+$/.test(url) && method === "PATCH",
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  routeFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EventFormDialog create", () => {
  it("presents an accessible dialog and focuses the title field on open", async () => {
    renderForm();

    expect(screen.getByRole("dialog", { name: "Нова подія" })).toBeInTheDocument();
    await waitFor(() => expect(titleField()).toHaveFocus());
  });

  it("keeps the optional sections collapsed until they are opened", async () => {
    renderForm();

    expect(screen.queryByLabelText("Розділ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Детальний опис")).not.toBeInTheDocument();

    await expandSection(/Місце в книзі/);

    expect(screen.getByLabelText("Розділ")).toBeInTheDocument();
  });

  it("hides the relations section because relations need a saved event", () => {
    renderForm();

    expect(screen.queryByText("Зв’язки з іншими подіями")).not.toBeInTheDocument();
  });

  it("creates an event from the title alone", async () => {
    const onOpenChange = vi.fn();
    renderForm({ onOpenChange });

    await userEvent.type(titleField(), "Геральт приймає замовлення");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти подію" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(bodyOf(createCall())).toMatchObject({
      isSpoiler: false,
      summary: null,
      timelineId: "line-1",
      title: "Геральт приймає замовлення",
    });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("sends the spoiler flag when the switch is turned on", async () => {
    renderForm();

    await userEvent.type(titleField(), "Смерть наставника");
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти подію" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    expect(bodyOf(createCall())).toMatchObject({ isSpoiler: true });
  });

  it("opens the place section with the current reading page already filled in", () => {
    renderForm({ readingPosition: makeReadingPosition({ currentPage: 42, positionKnown: true }) });

    expect(screen.getByLabelText("Сторінка")).toHaveValue(42);
  });

  it("rejects a page beyond the known book length and links the error to the field", async () => {
    renderForm({ pagesCount: 100 });

    await userEvent.type(titleField(), "Помилкова сторінка");
    await expandSection(/Місце в книзі/);
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
    await userEvent.click(screen.getByRole("switch"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти й додати ще" }));

    await waitFor(() => expect(createCall()).toBeDefined());
    await waitFor(() => expect(titleField()).toHaveValue(""));
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("EventFormDialog edit", () => {
  const editedEvent = makeTimelineEventView({
    id: "event-1",
    isSpoiler: true,
    resolvedByEventId: "event-9",
    threadStatus: "resolved",
    title: "Зникнення Йеннефер",
  });

  function renderEdit() {
    routeFetch({
      detail: makeTimelineEventDetailView({
        ...editedEvent,
        resolvedBy: makeTimelineEventPreview({ id: "event-9", title: "Викриття зрадника" }),
      }),
      listItems: [makeTimelineEventView({ id: "event-7", title: "Пророцтво відьми" })],
    });
    renderForm({ event: editedEvent });
  }

  it("shows the saved values and the edit-only footer", async () => {
    renderEdit();

    expect(titleField()).toHaveValue("Зникнення Йеннефер");
    expect(screen.getByRole("switch")).toBeChecked();
    expect(screen.getByRole("button", { name: "Зберегти зміни" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Зберегти й додати ще" })).not.toBeInTheDocument();
    expect(await screen.findByText("Викриття зрадника")).toBeInTheDocument();
  });

  it("presents the timeline as read-only information", () => {
    renderEdit();

    expect(screen.queryByRole("combobox", { name: "Часова лінія" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Щоб перенести подію до іншої лінії, скористайся дією «Перенести до лінії».",
      ),
    ).toBeInTheDocument();
  });

  it("drops the resolving event when the thread goes back to open", async () => {
    renderEdit();
    expect(await screen.findByText("Викриття зрадника")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Відкрите" }));
    await userEvent.click(screen.getByRole("radio", { name: "Розв’язано" }));

    expect(screen.queryByText("Викриття зрадника")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Пошук події-розв’язки")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(bodyOf(updateCall())).toMatchObject({
      resolvedByEventId: null,
      threadStatus: "resolved",
    });
  });

  it("drops the resolving event when the thread is removed entirely", async () => {
    renderEdit();
    expect(await screen.findByText("Викриття зрадника")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Немає" }));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(bodyOf(updateCall())).toMatchObject({
      resolvedByEventId: null,
      threadStatus: null,
    });
  });

  it("saves a relation immediately without submitting the form", async () => {
    renderEdit();

    await expandSection(/Зв’язки з іншими подіями/);
    await userEvent.click(await screen.findByRole("radio", { name: "Пророцтво відьми" }));

    await waitFor(() => expect(relationCall()).toBeDefined());
    expect(bodyOf(relationCall())).toEqual({
      relationType: "related",
      targetEventId: "event-7",
    });
    expect(updateCall()).toBeUndefined();
  });
});

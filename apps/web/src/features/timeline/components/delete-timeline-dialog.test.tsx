import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeTimelineView } from "../model/timeline.fixtures";
import { DeleteTimelineDialog } from "./delete-timeline-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const TARGET = makeTimelineView({
  eventsCount: 4,
  id: "line-3",
  isDefault: false,
  name: "Флешбеки",
  position: 2,
});

const DEFAULT_LINE = makeTimelineView({
  colorKey: "sage",
  eventsCount: 6,
  id: "line-2",
  isDefault: true,
  name: "Основна лінія",
  position: 1,
});

const FIRST_ALTERNATIVE = makeTimelineView({
  colorKey: "honey",
  eventsCount: 1,
  id: "line-1",
  isDefault: false,
  name: "Пролог",
  position: 0,
});

function deleteCall() {
  return fetchMock.mock.calls.find(
    ([, init]) => (init?.method ?? "GET").toUpperCase() === "DELETE",
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mountDialog(props: Partial<Parameters<typeof DeleteTimelineDialog>[0]> = {}) {
  const resolved = {
    bookId: "book-1",
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    timeline: TARGET,
    timelines: [FIRST_ALTERNATIVE, DEFAULT_LINE, TARGET],
    ...props,
  };
  renderWithProviders(<DeleteTimelineDialog {...resolved} />);
  return resolved;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeleteTimelineDialog", () => {
  it("confirms an empty line without strategies", async () => {
    const props = mountDialog({ timeline: makeTimelineView({ ...TARGET, eventsCount: 0 }) });

    expect(
      await screen.findByText("Цю лінію буде видалено. Скасувати цю дію неможливо."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Перемістити події/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(props.onDeleted).toHaveBeenCalledWith("line-3"));
    expect(String(deleteCall()?.[0])).not.toContain("strategy");
  });

  it("preselects Move onto the actual default line", async () => {
    mountDialog();

    expect(await screen.findByRole("radio", { name: /Перемістити події/ })).toBeChecked();
    expect(screen.getByRole("combobox")).toHaveTextContent("Основна лінія");

    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteCall()).toBeDefined());
    expect(String(deleteCall()?.[0])).toContain("strategy=move");
    expect(String(deleteCall()?.[0])).toContain("targetTimelineId=line-2");
  });

  it("falls back to the first alternative by position when the default is the deleted line", async () => {
    mountDialog({
      timeline: { ...DEFAULT_LINE, eventsCount: 4 },
      timelines: [FIRST_ALTERNATIVE, DEFAULT_LINE, TARGET],
    });

    expect(await screen.findByRole("combobox")).toHaveTextContent("Пролог");
  });

  it("preselects Delete when there is no other line", async () => {
    mountDialog({ timelines: [TARGET] });

    expect(await screen.findByRole("radio", { name: /Видалити разом із подіями/ })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /Перемістити події/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeDisabled();
  });

  it("requires the destructive confirmation checkbox before deleting with events", async () => {
    mountDialog();

    await userEvent.click(await screen.findByRole("radio", { name: /Видалити разом із подіями/ }));
    expect(screen.getByRole("button", { name: "Видалити" })).toBeDisabled();

    await userEvent.click(
      screen.getByRole("checkbox", { name: "Розумію, події буде видалено назавжди" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(deleteCall()).toBeDefined());
    expect(String(deleteCall()?.[0])).toContain("strategy=delete");
  });

  it("keeps the selected strategy and target on an API error", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        (init?.method ?? "GET").toUpperCase() === "DELETE"
          ? jsonResponse({ message: "boom" }, 500)
          : new Response(null, { status: 204 }),
      ),
    );

    const props = mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Видалити" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося змінити лінію"));
    expect(screen.getByRole("radio", { name: /Перемістити події/ })).toBeChecked();
    expect(screen.getByRole("combobox")).toHaveTextContent("Основна лінія");
    expect(props.onDeleted).not.toHaveBeenCalled();
  });

  it("returns to the parent on cancel", async () => {
    const props = mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(props.onClose).toHaveBeenCalled();
    expect(props.onDeleted).not.toHaveBeenCalled();
  });
});

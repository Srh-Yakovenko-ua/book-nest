import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeTimelineListView, makeTimelineView } from "../model/timeline.fixtures";
import { ManageTimelinesDialog } from "./manage-timelines-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

const DEFAULT_LINE = makeTimelineView({
  eventsCount: 4,
  id: "line-1",
  name: "Основна лінія",
  position: 0,
});

const SECOND_LINE = makeTimelineView({
  eventsCount: 0,
  id: "line-2",
  isDefault: false,
  name: "Флешбеки",
  position: 1,
});

const LINES = [DEFAULT_LINE, SECOND_LINE];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function listCalls() {
  return fetchMock.mock.calls.filter(
    ([url, init]) =>
      String(url).endsWith("/books/book-1/timelines") &&
      (init?.method ?? "GET").toUpperCase() === "GET",
  );
}

function mountDialog(handlers: Partial<Parameters<typeof ManageTimelinesDialog>[0]> = {}) {
  const props = {
    bookId: "book-1",
    onClose: vi.fn(),
    onCreate: vi.fn(),
    onDelete: vi.fn(),
    onEdit: vi.fn(),
    ...handlers,
  };
  renderWithProviders(<ManageTimelinesDialog {...props} />);
  return props;
}

async function openRowMenu(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Дії лінії «${name}»` }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(jsonResponse(makeTimelineListView({ timelines: LINES }))),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ManageTimelinesDialog", () => {
  it("shows skeleton rows while the list is loading", () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => {}));

    mountDialog();

    expect(screen.getByRole("status", { name: "Завантаження часових ліній" })).toBeInTheDocument();
  });

  it("offers an inline retry on a load error and keeps Готово usable", async () => {
    let call = 0;
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        call++ === 0
          ? jsonResponse({ message: "boom" }, 500)
          : jsonResponse(makeTimelineListView({ timelines: LINES })),
      ),
    );

    const props = mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Повторити" }));
    expect(await screen.findByText("Основна лінія")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("falls back to the anomaly empty state with a create action", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(makeTimelineListView({ timelines: [] }))),
    );

    const props = mountDialog();

    expect(await screen.findByText("Часові лінії ще не створені")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Нова часова лінія" }));
    expect(props.onCreate).toHaveBeenCalled();
  });

  it("lists the lines with a count, event counts and the neutral default badge", async () => {
    mountDialog();

    expect(await screen.findByText("2 часові лінії")).toBeInTheDocument();
    expect(screen.getByText("4 події")).toBeInTheDocument();
    expect(screen.getByText("0 подій")).toBeInTheDocument();
    expect(screen.getByText("Основна")).toBeInTheDocument();
  });

  it("disables the edge reorder controls", async () => {
    mountDialog();

    expect(
      await screen.findByRole("button", { name: "Перемістити «Основна лінія» вище" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Перемістити «Основна лінія» нижче" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Перемістити «Флешбеки» вище" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Перемістити «Флешбеки» нижче" })).toBeDisabled();
  });

  it("disables both reorder controls for a single line", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(jsonResponse(makeTimelineListView({ timelines: [DEFAULT_LINE] }))),
    );

    mountDialog();

    expect(
      await screen.findByRole("button", { name: "Перемістити «Основна лінія» вище" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Перемістити «Основна лінія» нижче" }),
    ).toBeDisabled();
  });

  it("refetches the canonical list and warns on a reorder conflict", async () => {
    fetchMock.mockImplementation((input) => {
      if (String(input).includes("/timelines/reorder")) {
        return Promise.resolve(
          jsonResponse({ code: "timeline_reorder_conflict", message: "conflict" }, 409),
        );
      }
      return Promise.resolve(jsonResponse(makeTimelineListView({ timelines: LINES })));
    });

    mountDialog();

    await userEvent.click(
      await screen.findByRole("button", { name: "Перемістити «Флешбеки» вище" }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Порядок уже змінився. Онови сторінку та спробуй ще раз.",
      ),
    );
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(1));
  });

  it("hides Make default and disables delete on the default line", async () => {
    mountDialog();

    await screen.findByText("Основна лінія");
    const menu = await openRowMenu("Основна лінія");

    expect(
      within(menu).queryByRole("menuitem", { name: "Зробити основною" }),
    ).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Видалити лінію" })).toHaveAttribute(
      "data-disabled",
    );
    expect(
      within(menu).getByText("Спочатку зробіть основною іншу часову лінію."),
    ).toBeInTheDocument();
  });

  it("promotes a non-default line without a confirmation step", async () => {
    mountDialog();

    await screen.findByText("Флешбеки");
    const menu = await openRowMenu("Флешбеки");
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Зробити основною" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes("/timelines/line-2/set-default")),
      ).toBe(true),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Основну лінію змінено"));
  });

  it("hands edit and delete of a non-default line back to the parent", async () => {
    const props = mountDialog();

    await screen.findByText("Флешбеки");
    await userEvent.click(
      within(await openRowMenu("Флешбеки")).getByRole("menuitem", { name: "Редагувати" }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: "line-2" }));

    await userEvent.click(
      within(await openRowMenu("Флешбеки")).getByRole("menuitem", { name: "Видалити лінію" }),
    );
    expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "line-2" }));
  });

  it("closes on Готово", async () => {
    const props = mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Готово" }));

    expect(props.onClose).toHaveBeenCalled();
  });
});

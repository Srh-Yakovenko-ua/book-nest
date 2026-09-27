import "@testing-library/jest-dom/vitest";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeTimelineView } from "../model/timeline.fixtures";
import { TimelineFormDialog } from "./timeline-form-dialog";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mountDialog(props: Partial<Parameters<typeof TimelineFormDialog>[0]> = {}) {
  const resolved = {
    bookId: "book-1",
    onClose: vi.fn(),
    timelines: [makeTimelineView({ colorKey: "parchment", id: "line-1" })],
    ...props,
  };
  renderWithProviders(<TimelineFormDialog {...resolved} />);
  return resolved;
}

function mutationBody(method: "PATCH" | "POST") {
  const call = fetchMock.mock.calls.find(
    ([, init]) => (init?.method ?? "GET").toUpperCase() === method,
  );
  if (call === undefined) throw new Error(`no ${method} captured`);
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(makeTimelineView())));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("TimelineFormDialog", () => {
  it("creates a line with the deterministic next free palette color", async () => {
    mountDialog({
      timelines: [
        makeTimelineView({ colorKey: "parchment", id: "line-1" }),
        makeTimelineView({ colorKey: "terracotta", id: "line-2" }),
      ],
    });

    expect(await screen.findByRole("radio", { checked: true })).toHaveAttribute(
      "aria-label",
      "Медовий",
    );

    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Спогади");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(mutationBody("POST").colorKey).toBe("honey"));
    expect(mutationBody("POST").name).toBe("Спогади");
    expect(mutationBody("POST").description).toBeNull();
  });

  it("keeps a manually chosen create color instead of recalculating it", async () => {
    mountDialog();

    await userEvent.click(await screen.findByRole("radio", { name: "Лісовий" }));
    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Паралельний сюжет");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(mutationBody("POST").colorKey).toBe("forest"));
  });

  it("offers exactly the eight canonical colors and no empty option", async () => {
    mountDialog();

    const radios = await screen.findAllByRole("radio");
    expect(radios).toHaveLength(8);
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "Пергамент",
      "Теракота",
      "Медовий",
      "Шавлія",
      "Лісовий",
      "Небесний",
      "Лаванда",
      "Пудрова троянда",
    ]);
    expect(screen.queryByRole("radio", { name: "Без кольору" })).not.toBeInTheDocument();
  });

  it("moves the color selection with the arrow, Home and End keys", async () => {
    mountDialog({ timelines: [] });

    const first = await screen.findByRole("radio", { name: "Пергамент" });
    expect(first).toHaveAttribute("aria-checked", "true");
    first.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Теракота" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Теракота" })).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("radio", { name: "Пудрова троянда" })).toHaveFocus();

    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("radio", { name: "Пергамент" })).toHaveFocus();

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Пудрова троянда" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("previews the marker with the typed name and falls back to the placeholder", async () => {
    mountDialog();

    expect(await screen.findByText("Напр. Основна сюжетна лінія")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Спогади");

    expect(screen.getByText("Спогади")).toBeInTheDocument();
  });

  it("edits an existing line and submits Зберегти зміни", async () => {
    const timeline = makeTimelineView({
      colorKey: "lavender",
      description: "Старий опис",
      id: "line-9",
      name: "Стара назва",
    });
    const props = mountDialog({ timeline, timelines: [timeline] });

    expect(await screen.findByRole("radio", { checked: true })).toHaveAttribute(
      "aria-label",
      "Лаванда",
    );

    const nameInput = screen.getByLabelText(/Назва лінії/);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Нова назва");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти зміни" }));

    await waitFor(() => expect(mutationBody("PATCH").name).toBe("Нова назва"));
    expect(mutationBody("PATCH").colorKey).toBe("lavender");
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });

  it("returns to the parent on cancel", async () => {
    const props = mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows a duplicate-name error inline, focuses the name and keeps the values", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        (init?.method ?? "GET").toUpperCase() === "POST"
          ? jsonResponse({ code: "timeline_duplicate_name", message: "duplicate" }, 409)
          : jsonResponse(makeTimelineView()),
      ),
    );

    const props = mountDialog();

    await userEvent.click(await screen.findByRole("radio", { name: "Небесний" }));
    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Основна лінія");
    await userEvent.type(screen.getByLabelText(/Опис/), "Текст");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    expect(await screen.findByText("Лінія з такою назвою вже існує")).toBeInTheDocument();
    expect(screen.getByLabelText(/Назва лінії/)).toHaveFocus();
    expect(screen.getByLabelText(/Назва лінії/)).toHaveValue("Основна лінія");
    expect(screen.getByLabelText(/Опис/)).toHaveValue("Текст");
    expect(screen.getByRole("radio", { name: "Небесний" })).toHaveAttribute("aria-checked", "true");
    expect(props.onClose).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("keeps the values and toasts on a generic API error", async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        (init?.method ?? "GET").toUpperCase() === "POST"
          ? jsonResponse({ message: "boom" }, 500)
          : jsonResponse(makeTimelineView()),
      ),
    );

    const props = mountDialog();

    await userEvent.type(screen.getByLabelText(/Назва лінії/), "Спогади");
    await userEvent.click(screen.getByRole("button", { name: "Створити" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Не вдалося змінити лінію"));
    expect(screen.getByLabelText(/Назва лінії/)).toHaveValue("Спогади");
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("requires a name before submitting", async () => {
    mountDialog();

    await userEvent.click(await screen.findByRole("button", { name: "Створити" }));

    expect(await screen.findByText("Введи назву лінії")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});

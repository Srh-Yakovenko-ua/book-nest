import "@testing-library/jest-dom/vitest";

import type { Nullable, SeriesView } from "@app/shared";

import { act } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { SeriesSelectOption } from "../model/series-select-option";
import type { SeriesSingleSelectPickerLabels } from "./series-single-select-picker";

import { toSeriesSelectOption } from "../model/series-select-option";
import { makeSeriesView } from "../model/series.fixtures";
import { SeriesSingleSelectPicker } from "./series-single-select-picker";

const LABELS: SeriesSingleSelectPickerLabels = {
  change: "Змінити",
  collapse: "Згорнути",
  empty: "Серій не знайдено",
  loadError: "Не вдалося завантажити серії",
  loading: "Шукаємо серії...",
  loadMoreError: "Не вдалося завантажити більше серій",
  results: "Ваші серії",
  resultsCount: (count: number) => `Показано ${count} серій`,
  retry: "Спробувати ще раз",
  search: "Пошук серії за назвою або автором",
};

const LIST_METRICS = { clientHeight: 240, scrollHeight: 1200 } as const;
const MEASURED_PROPERTIES = ["clientHeight", "scrollHeight", "scrollTop"] as const;

const fetchMock = vi.fn();
const onChange = vi.fn();

let respondToSeries: (params: URLSearchParams) => Response;
let scrollTop = 0;
let restoreMetrics: () => void = () => undefined;

function listParams(): URLSearchParams[] {
  return fetchMock.mock.calls.map(
    ([input]) => new URL(String(input), "http://localhost").searchParams,
  );
}

function makeSeries(index: number): SeriesView {
  return makeSeriesView({
    authors: [{ id: `author-${index}`, name: `Автор ${index}` }],
    id: `series-${index}`,
    name: `Цикл №${index}.`,
  });
}

function PickerHarness({ initialValue = null }: { initialValue?: Nullable<SeriesSelectOption> }) {
  const [value, setValue] = useState<Nullable<SeriesSelectOption>>(initialValue);

  return (
    <>
      <span id="picker-label">Серія</span>
      <SeriesSingleSelectPicker
        id="picker"
        labelledBy="picker-label"
        labels={LABELS}
        onChange={(series) => {
          onChange(series);
          setValue(toSeriesSelectOption(series));
        }}
        required
        value={value}
      />
    </>
  );
}

async function scrollListToBottom() {
  const wheel = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY: LIST_METRICS.scrollHeight - LIST_METRICS.clientHeight,
  });

  await act(async () => {
    screen.getByRole("radiogroup", { name: LABELS.results }).dispatchEvent(wheel);
  });
}

function searchInput(): HTMLElement {
  return screen.getByRole("textbox", { name: LABELS.search });
}

function seriesPage(items: SeriesView[], page = 1, pagesCount = 1): Response {
  return new Response(
    JSON.stringify({ items, page, pagesCount, pageSize: 20, totalCount: pagesCount * 20 }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function seriesRow(index: number): Promise<HTMLElement> {
  return screen.findByRole("radio", { name: new RegExp(`Цикл №${index}\\.`) });
}

function stubListMetrics() {
  const original = MEASURED_PROPERTIES.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get: () => LIST_METRICS.clientHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => LIST_METRICS.scrollHeight,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (next: number) => {
      scrollTop = next;
    },
  });

  restoreMetrics = () => {
    for (const [name, descriptor] of original) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
}

beforeEach(() => {
  scrollTop = 0;
  stubListMetrics();

  respondToSeries = () => seriesPage([makeSeries(1), makeSeries(2)]);

  onChange.mockReset();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (!url.startsWith("/api/series?")) return Promise.reject(new Error(`unexpected GET ${url}`));
    return Promise.resolve(respondToSeries(new URL(url, "http://localhost").searchParams));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
  vi.unstubAllGlobals();
});

describe("SeriesSingleSelectPicker query params", () => {
  it("asks the server for the first page of series sorted by name", async () => {
    renderWithProviders(<PickerHarness />);

    await seriesRow(1);

    const [first] = listParams();
    if (first === undefined) throw new Error("no series request was sent");
    expect(first.get("sort")).toBe("name_asc");
    expect(first.get("pageSize")).toBe("20");
    expect(first.get("pageNumber")).toBe("1");
    expect(first.get("search")).toBeNull();
  });
});

describe("SeriesSingleSelectPicker server-side search", () => {
  it("sends the typed search to the server once the debounce elapses", async () => {
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    await userEvent.type(searchInput(), "Дюна");

    await waitFor(() =>
      expect(listParams().map((params) => params.get("search"))).toContain("Дюна"),
    );
  });

  it("shows the rows the server matched instead of filtering the loaded ones", async () => {
    respondToSeries = (params) =>
      params.get("search") === null
        ? seriesPage([makeSeries(1), makeSeries(2)])
        : seriesPage([makeSeries(7)]);
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    await userEvent.type(searchInput(), "Герберт");

    expect(await seriesRow(7)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("trims the search before sending it", async () => {
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    await userEvent.type(searchInput(), "  Дюна  ");

    await waitFor(() =>
      expect(listParams().map((params) => params.get("search"))).toContain("Дюна"),
    );
    expect(listParams().map((params) => params.get("search"))).not.toContain("  Дюна  ");
  });
});

describe("SeriesSingleSelectPicker paging", () => {
  it("does not ask for a second page while the list is scrolled to the top", async () => {
    respondToSeries = (params) =>
      params.get("pageNumber") === "2"
        ? seriesPage([makeSeries(21)], 2, 2)
        : seriesPage([makeSeries(1), makeSeries(2)], 1, 2);

    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    expect(listParams().map((params) => params.get("pageNumber"))).toEqual(["1"]);
  });

  it("loads the second page on scroll, without any load-more button", async () => {
    respondToSeries = (params) =>
      params.get("pageNumber") === "2"
        ? seriesPage([makeSeries(21), makeSeries(22)], 2, 2)
        : seriesPage([makeSeries(1), makeSeries(2)], 1, 2);
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);
    expect(screen.queryByRole("button", { name: /ще/i })).not.toBeInTheDocument();

    await scrollListToBottom();

    expect(await seriesRow(21)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(listParams().map((params) => params.get("pageNumber"))).toEqual(["1", "2"]);
  });

  it("lets a series from the second page be selected", async () => {
    respondToSeries = (params) =>
      params.get("pageNumber") === "2"
        ? seriesPage([makeSeries(21)], 2, 2)
        : seriesPage([makeSeries(1)], 1, 2);
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);
    await scrollListToBottom();

    await userEvent.click(await seriesRow(21));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ id: "series-21" }));
  });

  it("stops asking for pages once the last page is loaded", async () => {
    respondToSeries = () => seriesPage([makeSeries(1), makeSeries(2)], 1, 1);
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    await scrollListToBottom();

    expect(listParams()).toHaveLength(1);
  });

  it("announces the grown result count after the second page arrives", async () => {
    respondToSeries = (params) =>
      params.get("pageNumber") === "2"
        ? seriesPage([makeSeries(21), makeSeries(22), makeSeries(23)], 2, 2)
        : seriesPage([makeSeries(1), makeSeries(2)], 1, 2);
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    await scrollListToBottom();

    await seriesRow(23);
    expect(screen.getByRole("status")).toHaveTextContent("Показано 5 серій");
  });

  it("keeps the loaded rows and offers a retry when the next page fails", async () => {
    let isNextPageBroken = true;
    respondToSeries = (params) => {
      if (params.get("pageNumber") !== "2") return seriesPage([makeSeries(1), makeSeries(2)], 1, 2);
      if (isNextPageBroken) return new Response("boom", { status: 500 });
      return seriesPage([makeSeries(21)], 2, 2);
    };
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);
    await scrollListToBottom();

    expect(await screen.findByRole("alert")).toHaveTextContent(LABELS.loadMoreError);
    expect(screen.queryByText(LABELS.loadError)).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);

    isNextPageBroken = false;
    await userEvent.click(screen.getByRole("button", { name: LABELS.retry }));

    expect(await seriesRow(21)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("SeriesSingleSelectPicker announcements", () => {
  it("announces loading while the first page is on its way", () => {
    respondToSeries = () => seriesPage([makeSeries(1)]);
    renderWithProviders(<PickerHarness />);

    expect(screen.getByRole("status")).toHaveTextContent(LABELS.loading);
  });

  it("announces the result count of the first page", async () => {
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    expect(screen.getByRole("status")).toHaveTextContent("Показано 2 серій");
  });

  it("announces an empty result", async () => {
    respondToSeries = () => seriesPage([]);

    renderWithProviders(<PickerHarness />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(LABELS.empty));
  });
});

describe("SeriesSingleSelectPicker results", () => {
  it("shows the empty copy when the server returns nothing", async () => {
    respondToSeries = () => seriesPage([]);

    renderWithProviders(<PickerHarness />);

    expect(
      await screen.findByText("Серій не знайдено", { selector: "p:not([role=status])" }),
    ).toBeInTheDocument();
  });

  it("shows the load error when the request fails", async () => {
    respondToSeries = () => new Response("boom", { status: 500 });

    renderWithProviders(<PickerHarness />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося завантажити серії");
  });

  it("marks the results radiogroup as required", async () => {
    renderWithProviders(<PickerHarness />);
    await seriesRow(1);

    expect(screen.getByRole("radiogroup", { name: LABELS.results })).toHaveAttribute(
      "aria-required",
      "true",
    );
  });
});

describe("SeriesSingleSelectPicker selection", () => {
  it("collapses to the picked series with a change button", async () => {
    renderWithProviders(<PickerHarness />);

    await userEvent.click(await seriesRow(2));

    expect(screen.queryByRole("textbox", { name: LABELS.search })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABELS.change })).toHaveAccessibleDescription(
      /Цикл №2\./,
    );
  });

  it("reopens the list with the picked series still checked on Змінити", async () => {
    renderWithProviders(<PickerHarness />);
    await userEvent.click(await seriesRow(2));

    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));

    expect(searchInput()).toHaveFocus();
    expect(await seriesRow(2)).toBeChecked();
  });

  it("keeps the picked series when a search replaces the rows and the list is collapsed", async () => {
    renderWithProviders(<PickerHarness />);
    await userEvent.click(await seriesRow(1));
    await userEvent.click(screen.getByRole("button", { name: LABELS.change }));
    respondToSeries = () => seriesPage([makeSeries(9)]);

    await userEvent.type(searchInput(), "Інше");
    await seriesRow(9);
    await userEvent.click(screen.getByRole("button", { name: LABELS.collapse }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Цикл №1.")).toBeInTheDocument();
  });
});

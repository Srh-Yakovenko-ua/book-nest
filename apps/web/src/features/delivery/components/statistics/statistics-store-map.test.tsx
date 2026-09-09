import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";
import type { ReactElement, ReactNode } from "react";

import { act, fireEvent } from "@testing-library/react";
import { cloneElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { useStoreHighlight } from "../../hooks/use-store-highlight";
import { makeStatisticsStore } from "../../model/statistics.fixtures";
import { StatisticsStoreMap } from "./statistics-store-map";

vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactElement<ChartSize> }) =>
    cloneElement(children, { height: 320, width: 480 }),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

type ChartSize = { height: number; width: number };

const YAKABOO = makeStatisticsStore({
  averageLandedBookCostByCurrency: [{ average: 620, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 3000, currency: "UAH" }],
  booksCount: 10,
  booksCountByCurrency: [{ count: 10, currency: "UAH" }],
  drilldown: { targets: [{ booksCount: 10, destination: "history_received", ordersCount: 4 }] },
  landedCoverageByCurrency: [
    { booksInScope: 10, booksWithLandedCost: 9, coveragePercent: 90, currency: "UAH" },
  ],
  landedEligibleBooksCountByCurrency: [{ count: 10, currency: "UAH" }],
  ordersCount: 4,
  ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
  store: "Yakaboo",
  totalsByCurrency: [{ currency: "UAH", total: 12000 }],
});

const VIVAT = makeStatisticsStore({
  averageLandedBookCostByCurrency: [{ average: 884, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 1210, currency: "UAH" }],
  booksCount: 6,
  booksCountByCurrency: [{ count: 6, currency: "UAH" }],
  drilldown: {
    targets: [
      { booksCount: 2, destination: "in_transit", ordersCount: 1 },
      { booksCount: 4, destination: "history_received", ordersCount: 3 },
    ],
  },
  landedCoverageByCurrency: [
    { booksInScope: 6, booksWithLandedCost: 5, coveragePercent: 83.3, currency: "UAH" },
  ],
  landedEligibleBooksCountByCurrency: [{ count: 5, currency: "UAH" }],
  ordersCount: 4,
  ordersCountByCurrency: [{ count: 4, currency: "UAH" }],
  store: "Vivat",
  totalsByCurrency: [{ currency: "UAH", total: 4840 }],
});

const NASH_FORMAT = makeStatisticsStore({
  averageLandedBookCostByCurrency: [{ average: 500, currency: "UAH" }],
  averageOrderAmountByCurrency: [{ average: 500, currency: "UAH" }],
  booksCount: 1,
  booksCountByCurrency: [{ count: 1, currency: "UAH" }],
  drilldown: { targets: [{ booksCount: 1, destination: "history_received", ordersCount: 1 }] },
  landedCoverageByCurrency: [
    { booksInScope: 1, booksWithLandedCost: 1, coveragePercent: 100, currency: "UAH" },
  ],
  landedEligibleBooksCountByCurrency: [{ count: 1, currency: "UAH" }],
  ordersCount: 1,
  ordersCountByCurrency: [{ count: 1, currency: "UAH" }],
  store: "Наш Формат",
  totalsByCurrency: [{ currency: "UAH", total: 500 }],
});

const OPEN_YAKABOO = "Переглянути замовлення магазину Yakaboo →";

const OPEN_VIVAT = "Переглянути замовлення магазину Vivat →";

const SELECT_HINT = "Натисніть на точку магазину, щоб вибрати його";

const STORE_MAP_POINT_RADIUS = 7;

function guideLinesOf(container: HTMLElement): Element[] {
  return [...container.querySelectorAll(".recharts-reference-line-line")];
}

function guidesOf(container: HTMLElement): Element[] {
  return guideLinesOf(container).filter((line) => line.getAttribute("stroke-opacity") !== "0");
}

function leave(store: string) {
  fireEvent.mouseOut(pointOf(store), { relatedTarget: document.body });
}

function pointGroupOf(storeKey: string): HTMLElement {
  return screen.getByTestId(`store-point-${storeKey}`);
}

function pointOf(store: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${store}:`) });
}

function renderLiveStoreMap(stores: BookOrderStatisticsStore[] = [YAKABOO, VIVAT]) {
  return renderWithProviders(<StoreMapHarness stores={stores} />);
}

function renderStoreMap({
  activeStoreKey = null as Nullable<string>,
  currency = "UAH" as Currency,
  isStale = false,
  onHover = vi.fn(),
  onSelect = vi.fn(),
  selectedStoreKey = null as Nullable<string>,
  stores = [YAKABOO, VIVAT] as BookOrderStatisticsStore[],
} = {}) {
  return renderWithProviders(
    <StatisticsStoreMap
      activeStoreKey={activeStoreKey}
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale,
        orderState: null,
        store: null,
      }}
      onHover={onHover}
      onSelect={onSelect}
      selectedStoreKey={selectedStoreKey}
      stores={stores}
    />,
  );
}

function StoreMapHarness({ stores }: { stores: BookOrderStatisticsStore[] }) {
  const highlight = useStoreHighlight();

  return (
    <StatisticsStoreMap
      activeStoreKey={highlight.activeStoreKey}
      currency="UAH"
      drilldown={{
        currencyFilter: null,
        displayCurrency: "UAH",
        isStale: false,
        orderState: null,
        store: null,
      }}
      onHover={highlight.hover}
      onSelect={highlight.select}
      selectedStoreKey={highlight.selectedStoreKey}
      stores={stores}
    />
  );
}

describe("StatisticsStoreMap", () => {
  it("names both axes and the currency they are counted in", () => {
    renderStoreMap();

    expect(screen.getByText("Фактична вартість книги, UAH")).toBeInTheDocument();
    expect(screen.getByText("Середній чек, UAH")).toBeInTheDocument();
  });

  it("keeps the direction hints under the chart", () => {
    renderStoreMap();

    expect(screen.getByText("← дешевша книга · дорожча →")).toBeInTheDocument();
    expect(screen.getByText("↑ більший середній чек")).toBeInTheDocument();
  });

  it("puts the exact numbers of a hovered store in the tooltip", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    await user.hover(pointOf("Vivat"));

    expect(await screen.findByText("Vivat")).toBeInTheDocument();
    expect(screen.getByText("884 UAH")).toBeInTheDocument();
    expect(screen.getByText("1 210 UAH")).toBeInTheDocument();
    expect(screen.getByText("5 із 6")).toBeInTheDocument();
    expect(screen.getByText("Замовлень")).toBeInTheDocument();
    expect(screen.getByText("83,3%")).toBeInTheDocument();
  });

  it("drops the technical wording about the currency of the orders", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    await user.hover(pointOf("Vivat"));

    expect(await screen.findByText("Замовлень")).toBeInTheDocument();
    expect(screen.queryByText("Замовлень у UAH")).toBe(null);
  });

  it("describes the store the ring is on, not the one recharts picked", async () => {
    const user = userEvent.setup();
    renderStoreMap({ activeStoreKey: "vivat" });

    await user.hover(pointOf("Yakaboo"));

    expect(await screen.findByText("884 UAH")).toBeInTheDocument();
    expect(screen.getByText("1 210 UAH")).toBeInTheDocument();
    expect(screen.queryByText("620 UAH")).toBe(null);
    expect(screen.queryByText("3 000 UAH")).toBe(null);
  });

  it("says nothing at all while no store is active", async () => {
    const user = userEvent.setup();
    renderStoreMap();

    await user.hover(pointOf("Vivat"));

    expect(screen.queryByText("884 UAH")).toBe(null);
  });

  it("keeps the tooltip free of anything clickable", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    await user.hover(pointOf("Vivat"));
    await screen.findByText("884 UAH");

    expect(screen.queryByRole("link")).toBe(null);
    expect(screen.queryAllByRole("button")).toEqual([pointOf("Yakaboo"), pointOf("Vivat")]);
    expect(screen.queryByText(/Переглянути замовлення/)).toBe(null);
  });

  it("tells the paired ranking which store the reader is on", async () => {
    const user = userEvent.setup();
    const onHover = vi.fn();
    renderStoreMap({ onHover });

    await user.hover(pointOf("Yakaboo"));

    expect(onHover).toHaveBeenCalledWith("yakaboo");
  });

  it("lets the keyboard reach a point and light it up", () => {
    const onHover = vi.fn();
    renderStoreMap({ onHover });
    const point = pointOf("Yakaboo");

    expect(point).toHaveAttribute("tabindex", "0");

    fireEvent.focus(point);

    expect(onHover).toHaveBeenCalledWith("yakaboo");
  });

  it("leaves the focus on the very point that received it", () => {
    renderLiveStoreMap();
    const point = pointOf("Yakaboo");

    act(() => point.focus());

    expect(point).toHaveFocus();
    expect(document.contains(point)).toBe(true);
    expect(pointOf("Yakaboo")).toBe(point);
  });

  it("holds the focus while it walks from one point to the next", () => {
    renderLiveStoreMap();
    const first = pointOf("Yakaboo");

    act(() => first.focus());
    const second = pointOf("Vivat");
    act(() => second.focus());

    expect(second).toHaveFocus();
    expect(document.contains(first)).toBe(true);
    expect(screen.getAllByTestId("store-point-focus-ring")).toHaveLength(1);
  });

  it("marks a focused point with a ring of its own", () => {
    renderLiveStoreMap();

    expect(screen.queryByTestId("store-point-focus-ring")).toBe(null);

    fireEvent.focus(pointOf("Yakaboo"));

    expect(screen.getByTestId("store-point-focus-ring")).toBeInTheDocument();

    fireEvent.blur(pointOf("Yakaboo"));

    expect(screen.queryByTestId("store-point-focus-ring")).toBe(null);
  });

  it("moves the focus ring on to the point focused next", () => {
    renderLiveStoreMap();

    fireEvent.focus(pointOf("Yakaboo"));
    fireEvent.blur(pointOf("Yakaboo"));
    fireEvent.focus(pointOf("Vivat"));

    expect(screen.getAllByTestId("store-point-focus-ring")).toHaveLength(1);
  });

  it("keeps the focus ring when the point left behind blurs late", () => {
    renderLiveStoreMap();

    fireEvent.focus(pointOf("Yakaboo"));
    fireEvent.focus(pointOf("Vivat"));
    fireEvent.blur(pointOf("Yakaboo"));

    expect(screen.getAllByTestId("store-point-focus-ring")).toHaveLength(1);
  });

  it("rings the point that holds the focus even while another store is active", () => {
    renderStoreMap({ activeStoreKey: "vivat" });

    fireEvent.focus(pointOf("Yakaboo"));

    expect(screen.getByTestId("store-point-focus-ring")).toHaveAttribute(
      "cx",
      pointOf("Yakaboo").getAttribute("cx"),
    );
  });

  it("keeps the focus ring after the pointer visits another point and leaves", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    fireEvent.focus(pointOf("Yakaboo"));
    await user.hover(pointOf("Vivat"));
    leave("Vivat");

    expect(screen.getAllByTestId("store-point-focus-ring")).toHaveLength(1);
    expect(screen.getByTestId("store-point-focus-ring")).toHaveAttribute(
      "cx",
      pointOf("Yakaboo").getAttribute("cx"),
    );
  });

  it("keeps a focused point at full strength while another store is active", () => {
    renderStoreMap({ activeStoreKey: "vivat" });

    fireEvent.focus(pointOf("Yakaboo"));

    expect(pointGroupOf("yakaboo")).toHaveAttribute("opacity", "1");
  });

  it("mutes nothing while the active store is one the chart could not place", () => {
    renderStoreMap({ activeStoreKey: "наш формат", stores: [YAKABOO, VIVAT, NASH_FORMAT] });

    expect(pointGroupOf("yakaboo")).toHaveAttribute("opacity", "1");
    expect(pointGroupOf("vivat")).toHaveAttribute("opacity", "1");
  });

  it("dims the points the reader is not pointing at", () => {
    renderStoreMap({ activeStoreKey: "vivat" });

    expect(pointGroupOf("vivat")).toHaveAttribute("opacity", "1");
    expect(pointGroupOf("yakaboo")).toHaveAttribute("opacity", "0.35");
  });

  it("catches a click that lands beside the drawn point", () => {
    renderLiveStoreMap();
    const target = pointOf("Yakaboo");

    expect(Number(target.getAttribute("r"))).toBeGreaterThan(STORE_MAP_POINT_RADIUS);
    expect(target).toHaveAttribute("fill", "transparent");

    fireEvent.click(target);

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toBeInTheDocument();
  });

  it("leaves the chart free of guides while no store is active", () => {
    const { container } = renderStoreMap();

    expect(guidesOf(container)).toHaveLength(0);
  });

  it("keeps both guide lines mounted so the points are never rebuilt", () => {
    const { container } = renderStoreMap();

    expect(guideLinesOf(container)).toHaveLength(2);
  });

  it("drops a dashed guide to each axis for the active store", () => {
    const { container } = renderStoreMap({ activeStoreKey: "vivat" });

    expect(guidesOf(container)).toHaveLength(2);
  });

  it("keeps the store name out of the chart itself", () => {
    renderStoreMap({ activeStoreKey: "vivat" });

    expect(screen.queryByText("Vivat")).toBe(null);
  });

  it("forgets a hovered store once the pointer leaves it", async () => {
    const user = userEvent.setup();
    const { container } = renderLiveStoreMap();

    await user.hover(pointOf("Yakaboo"));
    expect(guidesOf(container)).toHaveLength(2);

    leave("Yakaboo");

    expect(guidesOf(container)).toHaveLength(0);
  });

  it("keeps a clicked store lit after the pointer leaves it", () => {
    const { container } = renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    leave("Yakaboo");

    expect(guidesOf(container)).toHaveLength(2);
    expect(pointOf("Yakaboo")).toHaveAttribute("aria-pressed", "true");
  });

  it("waits for a click before offering the drill-down", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    expect(screen.getByText(SELECT_HINT)).toBeInTheDocument();

    await user.hover(pointOf("Yakaboo"));

    expect(screen.getByText(SELECT_HINT)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: OPEN_YAKABOO })).toBe(null);
  });

  it("keeps the drill-down reachable after the pointer leaves the clicked point", () => {
    renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toBeInTheDocument();

    leave("Yakaboo");

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&store=Yakaboo&currency=UAH",
    );
    expect(screen.queryByText(SELECT_HINT)).toBe(null);
  });

  it("lets a hover borrow the highlight without stealing the selection", async () => {
    const user = userEvent.setup();
    const { container } = renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    await user.hover(pointOf("Vivat"));

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toBeInTheDocument();
    expect(pointOf("Vivat")).toHaveAttribute("aria-pressed", "false");

    leave("Vivat");

    expect(guidesOf(container)).toHaveLength(2);
    expect(pointOf("Yakaboo")).toHaveAttribute("aria-pressed", "true");
  });

  it("moves the selection to the store clicked next", () => {
    renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    fireEvent.click(pointOf("Vivat"));

    expect(screen.getByRole("button", { name: OPEN_VIVAT })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: OPEN_YAKABOO })).toBe(null);
  });

  it("releases the store clicked a second time", () => {
    renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    fireEvent.click(pointOf("Yakaboo"));

    expect(pointOf("Yakaboo")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(SELECT_HINT)).toBeInTheDocument();
  });

  it("offers no drill-down at all rather than the hint while the numbers are stale", () => {
    renderStoreMap({ isStale: true, selectedStoreKey: "yakaboo" });

    expect(screen.queryByText(SELECT_HINT)).toBe(null);
    expect(screen.queryByRole("link", { name: OPEN_YAKABOO })).toBe(null);
  });

  it("exposes the plotted points instead of flattening the chart into one image", () => {
    renderStoreMap();

    expect(
      screen.getByRole("group", { name: "Точкова діаграма: ціна книги та середній чек" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBe(null);
  });

  it("drops the selection on Escape", async () => {
    const user = userEvent.setup();
    renderLiveStoreMap();

    fireEvent.click(pointOf("Yakaboo"));
    await user.keyboard("{Escape}");

    expect(screen.getByText(SELECT_HINT)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: OPEN_YAKABOO })).toBe(null);
  });

  it("selects a focused point with Enter", () => {
    renderLiveStoreMap();

    fireEvent.keyDown(pointOf("Yakaboo"), { key: "Enter" });

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toBeInTheDocument();
  });

  it("selects a focused point with Space", () => {
    renderLiveStoreMap();

    fireEvent.keyDown(pointOf("Yakaboo"), { key: " " });

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toBeInTheDocument();
  });

  it("opens the only place the selected store's orders ended up", () => {
    renderStoreMap({ selectedStoreKey: "yakaboo" });

    expect(screen.getByRole("link", { name: OPEN_YAKABOO })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&store=Yakaboo&currency=UAH",
    );
  });

  it("offers a choice when the selected store's orders ended up in two places", async () => {
    const user = userEvent.setup();
    renderStoreMap({ selectedStoreKey: "vivat" });

    await user.click(screen.getByRole("button", { name: OPEN_VIVAT }));

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toBeInTheDocument();
  });

  it("counts the stores it could not place in one compact row", async () => {
    const user = userEvent.setup();
    renderStoreMap({ stores: [YAKABOO, VIVAT, NASH_FORMAT] });

    await user.click(screen.getByRole("button", { name: "1 магазин не показано" }));

    expect(
      await screen.findByText("Для порівняння потрібні достатні дані про фактичну вартість книги."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Детальніше" })).toBe(null);
  });

  it("asks for a second store before drawing a comparison", () => {
    renderStoreMap({ stores: [YAKABOO] });

    expect(screen.getByText("Недостатньо даних для порівняння")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Потрібні щонайменше 2 магазини з достатніми даними про фактичну вартість книги.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Фактична вартість книги, UAH")).toBe(null);
  });
});

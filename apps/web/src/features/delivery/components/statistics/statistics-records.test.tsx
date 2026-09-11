import type { BookOrderStatisticsRecords } from "@app/shared";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { StatisticsRecords } from "./statistics-records";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...rest }: { children?: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const RECORDS: BookOrderStatisticsRecords = {
  bestValueStoreByCurrency: [
    {
      currency: "UAH",
      winners: [
        {
          averageLandedBookCost: 24.33,
          currency: "UAH",
          drilldown: {
            targets: [{ booksCount: 3, destination: "history_received", ordersCount: 2 }],
          },
          eligibleBooksCount: 3,
          store: "QA Test Книги",
          storeKey: "qa test книги",
        },
      ],
    },
  ],
  largestOrderByCurrency: [
    {
      currency: "UAH",
      winners: [
        {
          booksCount: 1,
          currency: "UAH",
          derivedStatus: "received",
          id: "largest-order",
          orderDate: "2026-02-06",
          orderNumber: "ORD-20260206",
          storeName: "Астролябія",
          totalAmount: 4250,
        },
      ],
    },
  ],
  mostActiveStore: {
    byBooks: [
      {
        booksCount: 21,
        drilldown: {
          targets: [{ booksCount: 21, destination: "history_received", ordersCount: 7 }],
        },
        ordersCount: 7,
        store: "Книгарня Є",
        storeKey: "книгарня є",
      },
    ],
    byOrders: [
      {
        booksCount: 13,
        drilldown: {
          targets: [
            { booksCount: 4, destination: "in_transit", ordersCount: 3 },
            { booksCount: 9, destination: "history_received", ordersCount: 6 },
          ],
        },
        ordersCount: 9,
        store: "Yakaboo",
        storeKey: "yakaboo",
      },
    ],
  },
  mostBooksInOrder: [
    {
      booksCount: 6,
      currency: "UAH",
      derivedStatus: "active",
      id: "fullest-order",
      orderDate: "2026-07-24",
      orderNumber: "ST-20260724-49",
      storeName: "Book24",
      totalAmount: 900,
    },
  ],
  recordMonthByCurrency: [
    {
      currency: "UAH",
      winners: [
        {
          booksCount: 31,
          currency: "UAH",
          drilldown: {
            targets: [
              { booksCount: 10, destination: "in_transit", ordersCount: 5 },
              { booksCount: 21, destination: "history_received", ordersCount: 13 },
            ],
          },
          month: "2026-08",
          ordersCount: 18,
          range: { from: "2026-08-15", to: "2026-08-22" },
          total: 18263,
        },
      ],
    },
  ],
  scope: {
    isPeriodFiltered: true,
    isTruncated: false,
    period: { from: "2026-01-01", to: "2026-08-22" },
  },
};

const TIED_ORDER = {
  booksCount: 6,
  currency: "UAH" as const,
  derivedStatus: "received" as const,
  orderDate: "2026-07-24",
  storeName: "Book24",
  totalAmount: 900,
};

function renderRecords({
  currency = "UAH" as const,
  records = RECORDS,
}: {
  currency?: "EUR" | "UAH";
  records?: BookOrderStatisticsRecords;
} = {}) {
  return renderWithProviders(
    <StatisticsRecords
      currency={currency}
      drilldown={{
        currencyFilter: null,
        displayCurrency: currency,
        isStale: false,
        orderState: null,
        store: null,
      }}
      records={records}
    />,
  );
}

describe("StatisticsRecords", () => {
  it("keeps its name and says which orders it looked at", () => {
    renderRecords();

    expect(screen.getByText("Рекорди")).toBeInTheDocument();
    expect(
      screen.getByText("Рекорди серед замовлень, оформлених 1 січня – 22 серпня 2026 р."),
    ).toBeInTheDocument();
  });

  it("says so plainly when nothing bounds the records", () => {
    renderRecords({
      records: { ...RECORDS, scope: { ...RECORDS.scope, period: { from: null, to: null } } },
    });

    expect(screen.getByText("Рекорди за весь час.")).toBeInTheDocument();
  });

  it("names all six records, split into money and counting", () => {
    renderRecords();

    expect(screen.getByText("За витратами")).toBeInTheDocument();
    expect(screen.getByText("За кількістю")).toBeInTheDocument();
    expect(screen.getByText("Найбільше витрат за місяць")).toBeInTheDocument();
    expect(screen.getByText("Найдорожче замовлення")).toBeInTheDocument();
    expect(screen.getByText("Найнижча фактична ціна книги")).toBeInTheDocument();
    expect(screen.getByText("Найбільше книг в одному замовленні")).toBeInTheDocument();
    expect(screen.getByText("Найбільше замовлень у магазині")).toBeInTheDocument();
    expect(screen.getByText("Найбільше книг куплено в магазині")).toBeInTheDocument();
  });

  it("puts the currency badge beside the spending group, not above the whole card", () => {
    renderRecords();

    const financial = screen.getByText("За витратами").closest("section");

    expect(financial).not.toBeNull();
    expect(within(financial ?? document.body).getByText("UAH")).toBeInTheDocument();

    const quantity = screen.getByText("За кількістю").closest("section");

    expect(within(quantity ?? document.body).queryByText("UAH")).not.toBeInTheDocument();
  });

  it("leads with the record month as the featured record", () => {
    renderRecords();

    expect(screen.getByText("серпень 2026 р. · 18 263 UAH")).toBeInTheDocument();
    expect(screen.getByText("18 замовлень · 31 книга")).toBeInTheDocument();
  });

  it("shows enough of the winning order to recognise it", () => {
    renderRecords();

    expect(screen.getByText("4 250 UAH")).toBeInTheDocument();
    expect(
      screen.getByText(/Астролябія · ORD-20260206 · 1 книга · 6 лют. 2026 р./),
    ).toBeInTheDocument();
  });

  it("keeps a missing money record in place instead of dropping the row", () => {
    renderRecords({ currency: "EUR" });

    expect(screen.getByText("Найбільше витрат за місяць")).toBeInTheDocument();
    expect(screen.getByText("Немає витрат у EUR за вибраний період.")).toBeInTheDocument();
    expect(screen.getByText("Немає замовлень із визначеною сумою в EUR.")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("leaves the counting records untouched when the money currency has nothing", () => {
    renderRecords({ currency: "EUR" });

    expect(screen.getByText("6 книг")).toBeInTheDocument();
    expect(screen.getByText("Yakaboo — 9 замовлень")).toBeInTheDocument();
    expect(screen.getByText("Книгарня Є — 21 книга")).toBeInTheDocument();
  });

  it("asks for more books rather than hiding the price record", () => {
    renderRecords({ records: { ...RECORDS, bestValueStoreByCurrency: [] } });

    expect(screen.getByText("Недостатньо даних")).toBeInTheDocument();
    expect(screen.getByText("Потрібно щонайменше 2 книги в одному магазині.")).toBeInTheDocument();
  });

  it("opens the priciest order by its identity", () => {
    renderRecords();

    expect(
      screen.getByRole("link", {
        name: /^Найдорожче замовлення: .+ UAH · Астролябія · ORD-20260206 · 1 книга/,
      }),
    ).toHaveAttribute("href", "/delivery/history?tab=received&orderId=largest-order");
  });

  it("opens the fullest order by its identity, wherever it now lives", () => {
    renderRecords();

    expect(
      screen.getByRole("link", { name: /^Найбільше книг в одному замовленні: 6 книг · Book24/ }),
    ).toHaveAttribute("href", "/delivery/in-transit?orderId=fullest-order");
  });

  it("opens the record month on the days the period actually covered", async () => {
    const user = userEvent.setup();
    renderRecords();

    await user.click(
      screen.getByRole("button", {
        name: /^Найбільше витрат за місяць: серпень 2026 р. · .+ UAH · 18 замовлень · 31 книга$/,
      }),
    );

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?orderedFrom=2026-08-15&orderedTo=2026-08-22&currency=UAH",
    );
    expect(screen.getByRole("menuitem", { name: /Отримані/ })).toHaveAttribute(
      "href",
      "/delivery/history?tab=received&from=2026-08-15&to=2026-08-22&currency=UAH",
    );
  });

  it("carries both the store and the record period into a store drill-down", async () => {
    const user = userEvent.setup();
    renderRecords();

    await user.click(
      screen.getByRole("button", {
        name: "Найбільше замовлень у магазині: Yakaboo — 9 замовлень · 13 книг",
      }),
    );

    expect(screen.getByRole("menuitem", { name: /У дорозі/ })).toHaveAttribute(
      "href",
      "/delivery/in-transit?store=Yakaboo&orderedFrom=2026-01-01&orderedTo=2026-08-22",
    );
  });

  it("opens the store that sold the most books on that same period", () => {
    renderRecords();

    expect(
      screen.getByRole("link", {
        name: "Найбільше книг куплено в магазині: Книгарня Є — 21 книга · 7 замовлень",
      }),
    ).toHaveAttribute(
      "href",
      `/delivery/history?tab=received&store=${encodeURIComponent("Книгарня Є").replace(/%20/g, "+")}&from=2026-01-01&to=2026-08-22`,
    );
  });

  it("offers the cheapest-book store as context, never as the very books it counted", () => {
    renderRecords();

    expect(
      screen.queryByRole("link", { name: /Найнижча фактична ціна книги/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Як рахується рекорд" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Переглянути замовлення магазину QA Test Книги →" }),
    ).toHaveAttribute(
      "href",
      `/delivery/history?tab=received&store=${encodeURIComponent("QA Test Книги").replace(/%20/g, "+")}&currency=UAH`,
    );
  });

  it("shows every equal winner of a tied record instead of picking one", () => {
    renderRecords({
      records: {
        ...RECORDS,
        mostBooksInOrder: [
          { ...TIED_ORDER, id: "tie-a", orderNumber: "TIE-A" },
          { ...TIED_ORDER, id: "tie-b", orderNumber: "TIE-B" },
          { ...TIED_ORDER, id: "tie-c", orderNumber: "TIE-C" },
        ],
      },
    });

    expect(screen.getAllByText("6 книг")).toHaveLength(3);
    expect(screen.getAllByText("Найбільше книг в одному замовленні")).toHaveLength(1);
    expect(
      screen.getAllByRole("link", { name: /Найбільше книг в одному замовленні/ }),
    ).toHaveLength(3);
  });

  it("tells the tied winners apart by name instead of repeating one label", () => {
    renderRecords({
      records: {
        ...RECORDS,
        mostBooksInOrder: [
          { ...TIED_ORDER, id: "tie-a", orderNumber: "TIE-A" },
          { ...TIED_ORDER, id: "tie-b", orderNumber: "TIE-B" },
          { ...TIED_ORDER, id: "tie-c", orderNumber: "TIE-C" },
        ],
      },
    });

    const names = screen
      .getAllByRole("link", { name: /Найбільше книг в одному замовленні/ })
      .map((link) => link.getAttribute("aria-label"));

    expect(new Set(names).size).toBe(3);
    expect(names.every((name) => name?.includes("6 книг"))).toBe(true);
    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringContaining("TIE-A"),
        expect.stringContaining("TIE-B"),
        expect.stringContaining("TIE-C"),
      ]),
    );
  });

  it("names the store each cheapest-price context link belongs to", () => {
    renderRecords({
      records: {
        ...RECORDS,
        bestValueStoreByCurrency: [
          {
            currency: "UAH",
            winners: [
              {
                averageLandedBookCost: 24.33,
                currency: "UAH",
                drilldown: {
                  targets: [{ booksCount: 3, destination: "history_received", ordersCount: 2 }],
                },
                eligibleBooksCount: 3,
                store: "QA Test Книги",
                storeKey: "qa test книги",
              },
              {
                averageLandedBookCost: 24.33,
                currency: "UAH",
                drilldown: {
                  targets: [{ booksCount: 2, destination: "history_received", ordersCount: 1 }],
                },
                eligibleBooksCount: 2,
                store: "Комора",
                storeKey: "комора",
              },
            ],
          },
        ],
      },
    });

    expect(
      screen.getByRole("link", { name: "Переглянути замовлення магазину QA Test Книги →" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Переглянути замовлення магазину Комора →" }),
    ).toBeInTheDocument();
  });

  it("warns that a cut-short source cannot hold an absolute record", () => {
    renderRecords({ records: { ...RECORDS, scope: { ...RECORDS.scope, isTruncated: true } } });

    expect(screen.getByText("Неповні дані")).toBeInTheDocument();
  });

  it("stops offering aggregate drill-downs once the source was cut short, but keeps exact orders", () => {
    renderRecords({ records: { ...RECORDS, scope: { ...RECORDS.scope, isTruncated: true } } });

    expect(
      screen.queryByRole("button", { name: /Найбільше витрат за місяць/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Найдорожче замовлення/ })).toBeInTheDocument();
  });
});

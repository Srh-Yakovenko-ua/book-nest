import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { CreateBookOrderDialog } from "./create-book-order-dialog";

const availableBook = makeBookView({
  id: "available-book",
  ownershipStatus: "none",
  title: "Доступна книга",
});
const secondAvailableBook = makeBookView({
  id: "second-available-book",
  ownershipStatus: "none",
  title: "Друга доступна книга",
});
const inTransitWithoutActiveOrder = makeBookView({
  id: "in-transit-without-active-order",
  ownershipStatus: "in_transit",
  title: "У дорозі без активного замовлення",
});
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const body = String(input).includes("purchase-stores")
      ? []
      : {
          items: [availableBook, secondAvailableBook],
          page: 1,
          pagesCount: 1,
          pageSize: 24,
          totalCount: 2,
        };
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CreateBookOrderDialog book picker view", () => {
  it("offers every book the library returns, without hiding rows after the fact", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const body = String(input).includes("purchase-stores")
        ? []
        : {
            items: [inTransitWithoutActiveOrder, availableBook],
            page: 1,
            pagesCount: 1,
            pageSize: 24,
            totalCount: 2,
          };
      return Promise.resolve(
        new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
      );
    });
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("У дорозі без активного замовлення");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    const firstCheckbox = checkboxes.at(0);
    if (firstCheckbox === undefined) throw new Error("Book checkbox was not rendered");
    expect(firstCheckbox).toBeEnabled();

    await userEvent.click(firstCheckbox);
    expect(screen.getByText("Вибрано книг: 1")).toBeVisible();
  });

  it("asks the library to drop books that already sit in an active order", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");

    const booksRequest = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.startsWith("/api/books?"));
    if (booksRequest === undefined) throw new Error("Books request was not sent");

    const params = new URL(booksRequest, "http://localhost").searchParams;
    expect(params.get("hasActiveOrder")).toBe("false");
    expect(params.getAll("owner")).toEqual(["none", "want_to_buy", "in_transit"]);
  });

  it("presents the form as four described sections", () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    expect(screen.getByRole("heading", { name: "Замовлення" })).toBeVisible();
    expect(screen.getByText("Де і коли ви оформили покупку.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Книги" })).toBeVisible();
    expect(screen.getByText("Додайте одну або кілька книг із цього замовлення.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Вартість" })).toBeVisible();
    expect(screen.getByText("Оберіть, як зручно зафіксувати суму замовлення.")).toBeVisible();
    expect(screen.getByText("Фінальна сума з урахуванням доставки та знижки.")).toBeVisible();
    expect(screen.getByText("Деталізація (необов’язково)")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Доставка" })).toBeVisible();
    expect(screen.getByText("Дані відправлення можна додати зараз або пізніше.")).toBeVisible();
    expect(screen.getByLabelText(/Коментар/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Скасувати" })).toBeVisible();
    expect(screen.getByText(/Книги ще не прив’язані до посилки/)).toBeVisible();
    expect(screen.queryByText("(необовʼязково)")).not.toBeInTheDocument();
    expect(screen.getByText("*")).toBeVisible();
  });

  it("keeps one dialog, form data and selection across view changes", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);
    const store = screen.getByLabelText("Магазин");
    await userEvent.type(store, "Yakaboo");

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Назад до замовлення/ })).toBeVisible();

    await screen.findByText("Доступна книга");
    const firstBookCheckbox = screen.getAllByRole("checkbox").at(0);
    if (firstBookCheckbox === undefined) throw new Error("Book checkbox was not rendered");
    await userEvent.click(firstBookCheckbox);
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));

    expect(screen.getByLabelText("Магазин")).toHaveValue("Yakaboo");
    expect(screen.getAllByText("Доступна книга").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Фінальна сума")).toBeVisible();
    expect(screen.queryByLabelText("Ціна книги «Доступна книга»")).not.toBeInTheDocument();
    expect(screen.queryByText("Підсумок")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Фінальна сума"), "1800");
    await userEvent.type(screen.getByLabelText("Вартість доставки"), "100");
    await userEvent.type(screen.getByLabelText("Знижка"), "200");
    expect(screen.getByText("Сплачено всього")).toBeVisible();
    expect(screen.getByText("1 800 UAH")).toBeVisible();
    expect(screen.getByText("З них доставка")).toBeVisible();
    expect(screen.getByText("Знижка застосована")).toBeVisible();
    expect(screen.getByText("200 UAH")).toBeVisible();

    await userEvent.click(screen.getByRole("radio", { name: "По книгах" }));
    expect(screen.queryByLabelText("Фінальна сума")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Ціна книги «Доступна книга»"), "500");
    expect(screen.getAllByText("500 UAH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("400 UAH").length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("radio", { name: "Загальною сумою" }));
    expect(screen.getByLabelText("Фінальна сума")).toHaveValue(null);
    expect(screen.queryByLabelText("Ціна книги «Доступна книга»")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "По книгах" }));
    expect(screen.getByLabelText("Ціна книги «Доступна книга»")).toHaveValue(null);
    await userEvent.click(screen.getByRole("button", { name: "Створити замовлення" }));
    expect(
      screen.getByText("У режимі «По книгах» вкажіть ціну кожної вибраної книги."),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    expect(screen.getByText("Вибрано книг: 1")).toBeVisible();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("shows zero, partial and complete per-book price states", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");
    await userEvent.click(screen.getByRole("button", { name: "Вибрати всі показані (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));
    await userEvent.click(screen.getByRole("radio", { name: "По книгах" }));

    expect(screen.getByText("Ціни вказані для 0 із 2 книг.")).toBeVisible();
    expect(
      screen.getByText("Вкажіть ціну кожної книги, щоб побачити автоматичний підсумок."),
    ).toBeVisible();
    expect(
      screen.getByText("Підсумок з’явиться, коли ви вкажете ціну кожної книги."),
    ).toBeVisible();

    await userEvent.type(screen.getByLabelText("Ціна книги «Доступна книга»"), "500");
    expect(screen.getByText("Ціни вказані для 1 із 2 книг.")).toBeVisible();
    expect(
      screen.getByText("Вкажіть ціну ще для 1 книги, щоб розрахувати підсумок."),
    ).toBeVisible();

    await userEvent.type(screen.getByLabelText("Ціна книги «Друга доступна книга»"), "600");
    expect(screen.getByText("Усі ціни вказані.")).toBeVisible();
    expect(screen.getByText("Підсумок розраховано автоматично.")).toBeVisible();
    expect(screen.getAllByText("1 100 UAH")).toHaveLength(2);
  });

  it("names the negative total instead of calling the summary automatic", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");
    await userEvent.click(screen.getByRole("button", { name: "Вибрати всі показані (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));
    await userEvent.click(screen.getByRole("radio", { name: "По книгах" }));
    await userEvent.type(screen.getByLabelText("Ціна книги «Доступна книга»"), "100");
    await userEvent.type(screen.getByLabelText("Ціна книги «Друга доступна книга»"), "100");
    await userEvent.type(screen.getByLabelText("Знижка"), "500");

    expect(
      screen.getByText("Знижка більша за вартість книг і доставки — підсумок виходить від’ємним."),
    ).toBeVisible();
    expect(screen.queryByText("Підсумок розраховано автоматично.")).not.toBeInTheDocument();
  });

  it("keeps the submit error true to the draft instead of freezing it", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");
    await userEvent.click(screen.getByRole("button", { name: "Вибрати всі показані (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));
    await userEvent.click(screen.getByRole("radio", { name: "По книгах" }));
    await userEvent.type(screen.getByLabelText("Ціна книги «Доступна книга»"), "100");
    await userEvent.type(screen.getByLabelText("Ціна книги «Друга доступна книга»"), "100");
    await userEvent.type(screen.getByLabelText("Знижка"), "500");
    await userEvent.click(screen.getByRole("button", { name: "Створити замовлення" }));

    const message = "Знижка більша за вартість книг і доставки — підсумок виходить від’ємним.";
    expect(screen.getAllByText(message)).toHaveLength(2);

    await userEvent.clear(screen.getByLabelText("Знижка"));

    expect(screen.queryByText(message)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      "/api/delivery/orders",
    );
  });

  it("keeps shipment fields behind the shipped choice", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    expect(screen.queryByLabelText("Служба доставки")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Так, уже відправили" }));
    expect(screen.getByLabelText("Служба доставки")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Посилка" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Посилка 1" })).not.toBeInTheDocument();
    expect(screen.queryByText("Книги в посилці")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Видалити посилку 1" })).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Якщо магазин відправляє книги окремими посилками, розподіліть книги між ними.",
      ),
    ).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Розділити доставку" }));
    expect(screen.getByRole("heading", { name: "Посилка 1" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Посилка 2" })).toBeVisible();
    expect(screen.getAllByText("Книги ще не додані")).toHaveLength(2);

    await userEvent.click(screen.getByRole("radio", { name: "Ще ні" }));
    expect(screen.queryByLabelText("Служба доставки")).not.toBeInTheDocument();
  });

  it("distributes only unassigned books between multiple shipments", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");
    await userEvent.click(screen.getByRole("button", { name: "Вибрати всі показані (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));
    await userEvent.click(screen.getByRole("radio", { name: "Так, уже відправили" }));
    await userEvent.click(screen.getByRole("button", { name: "Розділити доставку" }));

    const unassignedCount = screen.getByText("2 книги ще не прив’язані до жодної посилки.");
    expect(unassignedCount).toBeVisible();
    const distributionStatus = unassignedCount.closest('[role="status"]');
    if (!(distributionStatus instanceof HTMLElement)) {
      throw new Error("Distribution status was not rendered");
    }
    expect(
      within(distributionStatus).getByText(
        "Розподіліть їх між посилками, щоб завершити налаштування доставки.",
      ),
    ).toBeVisible();
    expect(within(distributionStatus).queryByText("Доступна книга")).not.toBeInTheDocument();
    expect(within(distributionStatus).queryByText("Друга доступна книга")).not.toBeInTheDocument();
    expect(screen.getAllByText("0 книг")).toHaveLength(2);

    const addButtons = screen.getAllByRole("button", { name: "Додати книги" });
    const firstAddButton = addButtons.at(0);
    if (firstAddButton === undefined) throw new Error("First shipment action was not rendered");
    await userEvent.click(firstAddButton);
    await userEvent.click(screen.getByRole("checkbox", { name: "Доступна книга" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));

    expect(screen.getByText("1 книга ще не прив’язана до жодної посилки.")).toBeVisible();
    expect(screen.getByText("У посилці 1 книга")).toBeVisible();

    const secondAddButton = screen.getByRole("button", { name: "Додати книги" });
    await userEvent.click(secondAddButton);
    expect(screen.queryByRole("checkbox", { name: "Доступна книга" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Друга доступна книга" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));

    expect(screen.getByText("Усі книги розподілено")).toBeVisible();
    expect(screen.getAllByText("1 книга")).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Додати ще одну посилку" }));
    expect(screen.getByRole("heading", { name: "Посилка 3" })).toBeVisible();
    expect(screen.getAllByText("Книги ще не додані")).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Видалити посилку 3" }));
    expect(screen.queryByRole("heading", { name: "Посилка 3" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Видалити посилку 1" }));
    expect(screen.getByRole("heading", { name: "Видалити Посилку 1?" })).toBeVisible();
    expect(
      screen.getByText(
        "Книги з цієї посилки залишаться в замовленні та перейдуть до нерозподілених.",
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Видалити" }));
    expect(screen.getByText("1 книга ще не прив’язана до жодної посилки.")).toBeVisible();
    expect(screen.getAllByRole("heading", { name: /Посилка/ })).toHaveLength(1);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Видалити посилку 1" })).not.toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Об’єднати все в одну посилку" }));
    expect(screen.getByRole("heading", { name: "Посилка" })).toBeVisible();
    expect(screen.queryByText("Ще не розподілено по посилках")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Розділити доставку" })).toBeVisible();
  });

  it("returns to simple mode after deleting an empty second shipment", async () => {
    renderWithProviders(<CreateBookOrderDialog onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));
    await screen.findByText("Доступна книга");
    await userEvent.click(screen.getByRole("button", { name: "Вибрати всі показані (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));
    await userEvent.click(screen.getByRole("radio", { name: "Так, уже відправили" }));
    await userEvent.click(screen.getByRole("button", { name: "Розділити доставку" }));

    const firstAddButton = screen.getAllByRole("button", { name: "Додати книги" }).at(0);
    if (firstAddButton === undefined) throw new Error("First shipment action was not rendered");
    await userEvent.click(firstAddButton);
    await userEvent.click(screen.getByRole("checkbox", { name: "Доступна книга" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Друга доступна книга" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати вибір" }));

    await userEvent.click(screen.getByRole("button", { name: "Видалити посилку 2" }));
    expect(screen.getByRole("heading", { name: "Посилка" })).toBeVisible();
    expect(screen.queryByText("Усі книги розподілено")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Видалити посилку/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Розділити доставку" })).toBeVisible();
  });
});

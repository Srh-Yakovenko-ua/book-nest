import "@testing-library/jest-dom/vitest";

import type {
  PaginatedTagCatalog,
  TagCatalogListItem,
  TagDeletionPreviewView,
  TagsCatalogFacetsView,
  TagsSummaryView,
} from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ComponentProps } from "react";

import { QueryClient } from "@tanstack/react-query";
import { act } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { tagsKeys } from "../api/tags-keys";
import { TagsView } from "./tags-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/tags",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

type RecordedRequest = {
  body: unknown;
  method: string;
  path: string;
  searchParams: URLSearchParams;
};

type Reply = (request: RecordedRequest) => Promise<Response>;

const SLOW_BURN: TagCatalogListItem = {
  booksCount: 3,
  charactersCount: 2,
  color: "rose",
  description: "Повільний розвиток почуттів",
  id: "tag-slow-burn",
  name: "slow burn",
  type: "trope",
  usageCount: 5,
};

const COZY: TagCatalogListItem = {
  booksCount: 0,
  charactersCount: 0,
  color: "parchment",
  description: null,
  id: "tag-cozy",
  name: "cozy",
  type: "atmosphere",
  usageCount: 0,
};

const FACETS: TagsCatalogFacetsView = {
  quickCounts: { all: 2, books: 1, characters: 1, unused: 1, used: 1 },
};

const SUMMARY: TagsSummaryView = {
  colorCounts: {
    forest: 0,
    honey: 0,
    lavender: 0,
    parchment: 1,
    rose: 1,
    sage: 0,
    sky: 0,
    terracotta: 0,
  },
  mostUsed: null,
  taggedBooksCount: 3,
  taggedCharactersCount: 2,
  totalBooksCount: 10,
  totalCharactersCount: 4,
  totalTagsCount: 2,
  typeCounts: { atmosphere: 1, character: 0, custom: 0, format: 0, theme: 0, trope: 1 },
  usageDistribution: { booksOnly: 0, both: 1, charactersOnly: 0, unused: 1 },
};

const PREVIEW: TagDeletionPreviewView = { bookLinksCount: 3, characterLinksCount: 0 };

const requests: RecordedRequest[] = [];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(toast.success).mockClear();
  requests.length = 0;
});

describe("TagsView", () => {
  it("renders the header, the catalog and the counter", async () => {
    mockTagsApi();

    renderTags();

    expect(screen.getByRole("heading", { level: 1, name: "Теги" })).toBeInTheDocument();
    expect(
      screen.getByText("Створюйте та впорядковуйте власну систему тегів для книг і персонажів"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати тег" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByText("Повільний розвиток почуттів")).toBeInTheDocument();
    expect(screen.getByText("Показано 2 із 2 тегів")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Жанри" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати ще" })).not.toBeInTheDocument();
  });

  it("shows quick-filter counts from facets and keeps the chips usable when facets fail", async () => {
    mockTagsApi();
    const { unmount } = renderTags();

    expect(await quickFilter("Невикористані")).toHaveTextContent("Невикористані1");
    unmount();

    mockTagsApi({ "GET /api/tags/catalog/facets": failure(500) });
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("", (event) => urlUpdates.push(event));

    await screen.findByRole("heading", { level: 3, name: "slow burn" });
    const unused = await quickFilter("Невикористані");
    expect(unused).toHaveTextContent(/^Невикористані$/);

    await userEvent.click(unused);

    await waitFor(() => expect(urlUpdates.at(-1)?.queryString).toBe("?filter=unused"));
  });

  it("appends the next page on Показати ще and hides it on the last page", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": (request) =>
        json(
          request.searchParams.get("pageNumber") === "2"
            ? page([COZY], { page: 2, pagesCount: 2, totalCount: 2 })
            : page([SLOW_BURN], { pagesCount: 2, totalCount: 2 }),
        ),
    });

    renderTags();

    expect(await screen.findByText("Показано 1 із 2 тегів")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Показати ще" }));

    expect(await screen.findByRole("heading", { level: 3, name: "cozy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByText("Показано 2 із 2 тегів")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Показати ще" })).not.toBeInTheDocument();
    expect(requestsTo("GET /api/tags/catalog").map((r) => r.searchParams.get("pageSize"))).toEqual([
      "20",
      "20",
    ]);
  });

  it("keeps loaded rows and offers a retry when the next page fails", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": (request) =>
        request.searchParams.get("pageNumber") === "2"
          ? failure(500)()
          : json(page([SLOW_BURN], { pagesCount: 2, totalCount: 2 })),
    });

    renderTags();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));

    expect(await screen.findByText("Не вдалося завантажити ще теги.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Спробувати знову" })).toBeInTheDocument();
  });

  it("shows the first-use state when no tags exist", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": () => json(page([])),
      "GET /api/tags/summary": () =>
        json({
          ...SUMMARY,
          totalTagsCount: 0,
          usageDistribution: { booksOnly: 0, both: 0, charactersOnly: 0, unused: 0 },
        }),
    });

    renderTags();

    expect(await screen.findByText("У вас ще немає тегів")).toBeInTheDocument();
    expect(screen.queryByLabelText("Пошук тегу")).not.toBeInTheDocument();
  });

  it("shows the positive all-used state only for filter=unused without q/type/color", async () => {
    const summary = {
      ...SUMMARY,
      usageDistribution: { booksOnly: 0, both: 2, charactersOnly: 0, unused: 0 },
    };
    mockTagsApi({
      "GET /api/tags/catalog": () => json(page([])),
      "GET /api/tags/summary": () => json(summary),
    });
    const { unmount } = renderTags("?filter=unused");

    expect(await screen.findByText("Усі теги використовуються")).toBeInTheDocument();
    unmount();

    renderTags("?filter=unused&type=trope");

    expect(await screen.findByText("Тегів за цими умовами не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("Усі теги використовуються")).not.toBeInTheDocument();
  });

  it("renders chips for q/type/color only and clears them while keeping sort", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?q=cozy&type=trope&color=rose&filter=unused&sort=name_asc", (event) =>
      urlUpdates.push(event),
    );

    const chips = await screen.findByRole("group", { name: "Активні фільтри" });
    expect(within(chips).getByText("Пошук: cozy")).toBeInTheDocument();
    expect(within(chips).getByText("Тропи")).toBeInTheDocument();
    expect(within(chips).getByText("Пудрова троянда")).toBeInTheDocument();
    expect(within(chips).queryByText("Невикористані")).not.toBeInTheDocument();

    await userEvent.click(within(chips).getByRole("button", { name: "Очистити все" }));

    await waitFor(() => expect(urlUpdates.at(-1)?.queryString).toBe("?sort=name_asc"));
  });

  describe("Summary and sidebar", () => {
    it("renders four summary cards with a non-clickable tie indicator", async () => {
      mockTagsApi({
        "GET /api/tags/summary": () =>
          json({
            ...SUMMARY,
            mostUsed: {
              leaders: [
                { booksCount: 3, charactersCount: 2, id: SLOW_BURN.id, name: "slow burn" },
                { booksCount: 5, charactersCount: 0, id: "tag-other", name: "found family" },
              ],
              leadersCount: 3,
              usageCount: 5,
            },
          }),
      });

      renderTags();

      for (const label of [
        "Усього тегів",
        "Книг із тегами",
        "Персонажів із тегами",
        "Найуживаніший тег",
      ]) {
        expect(await screen.findByText(label)).toBeInTheDocument();
      }
      expect(screen.getByText("Книги: 3 · Персонажі: 2")).toBeInTheDocument();
      expect(screen.getByText("ще 2 теги")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /ще 2 теги/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /ще 2 теги/ })).not.toBeInTheDocument();
      expect(screen.getByText("1 невикористаний")).toBeInTheDocument();
    });

    it("never renders NaN or Infinity for an empty library and character population", async () => {
      mockTagsApi({
        "GET /api/tags/summary": () =>
          json({
            ...SUMMARY,
            taggedBooksCount: 0,
            taggedCharactersCount: 0,
            totalBooksCount: 0,
            totalCharactersCount: 0,
          }),
      });

      renderTags();

      expect(await screen.findByText(/бібліотеки$/)).toHaveTextContent(/^0s?%/);
      expect(screen.getByText(/усіх персонажів$/)).toHaveTextContent(/^0s?%/);
      expect(document.body.textContent).not.toMatch(/NaN|Infinity|∞/);
    });

    it("keeps the catalog usable and offers a local retry when the summary fails", async () => {
      mockTagsApi({ "GET /api/tags/summary": failure(500) });

      renderTags();

      expect(
        await screen.findByRole("heading", { level: 3, name: "slow burn" }),
      ).toBeInTheDocument();
      expect(await screen.findByText("Не вдалося завантажити огляд тегів.")).toBeInTheDocument();
      expect(screen.queryByRole("complementary", { name: "Огляд тегів" })).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Спробувати знову" }));

      await waitFor(() => expect(requestsTo("GET /api/tags/summary")).toHaveLength(2));
    });

    it("keeps the cards and the sidebar when a background summary refetch fails", async () => {
      let summaryAttempts = 0;
      mockTagsApi({
        "GET /api/tags/summary": () => {
          summaryAttempts += 1;
          return summaryAttempts === 1 ? json(SUMMARY) : failure(500)();
        },
      });
      const { queryClient } = renderTags();
      expect(await screen.findByText("Усього тегів")).toBeInTheDocument();

      await act(() => queryClient.refetchQueries({ queryKey: tagsKeys.summary }));

      expect(requestsTo("GET /api/tags/summary")).toHaveLength(2);
      expect(queryClient.getQueryState(tagsKeys.summary)?.status).toBe("error");
      expect(screen.getByText("Усього тегів")).toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "Огляд тегів" })).toBeInTheDocument();
      expect(screen.queryByText("Не вдалося завантажити огляд тегів.")).not.toBeInTheDocument();
    });

    it("sets filter=unused from the attention block while keeping q, type, color and sort", async () => {
      mockTagsApi();
      const urlUpdates: UrlUpdateEvent[] = [];
      renderTags("?q=cozy&type=trope&color=rose&sort=name_asc", (event) => urlUpdates.push(event));

      const sidebar = await screen.findByRole("complementary", { name: "Огляд тегів" });
      await userEvent.click(
        within(sidebar).getByRole("button", { name: "Показати невикористані" }),
      );

      await waitFor(() => {
        const params = new URLSearchParams(urlUpdates.at(-1)?.queryString);
        expect(params.get("filter")).toBe("unused");
        expect(params.get("q")).toBe("cozy");
        expect(params.getAll("type")).toEqual(["trope"]);
        expect(params.getAll("color")).toEqual(["rose"]);
        expect(params.get("sort")).toBe("name_asc");
      });
    });

    it("lists all six types, toggles type[] and color[], and keeps usage informational", async () => {
      mockTagsApi();
      const urlUpdates: UrlUpdateEvent[] = [];
      renderTags("?type=trope", (event) => urlUpdates.push(event));

      const sidebar = await screen.findByRole("complementary", { name: "Огляд тегів" });
      const structure = within(sidebar).getByRole("region", { name: "Структура тегів" });
      expect(within(structure).getAllByRole("button")).toHaveLength(6);
      expect(within(structure).getByRole("button", { name: /^Тропи: 1 тег/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(within(structure).getByRole("button", { name: /^Теми: 0 тегів/ })).toHaveAttribute(
        "aria-pressed",
        "false",
      );

      await userEvent.click(within(structure).getByRole("button", { name: /^Атмосфера/ }));
      await waitFor(() =>
        expect(new URLSearchParams(urlUpdates.at(-1)?.queryString).get("type")).toBe(
          "trope,atmosphere",
        ),
      );

      const palette = within(sidebar).getByRole("region", { name: "Палітра тегів" });
      expect(within(palette).getAllByRole("button")).toHaveLength(8);
      await userEvent.click(
        within(palette).getByRole("button", { name: "Пудрова троянда: 1 тег" }),
      );
      await waitFor(() =>
        expect(new URLSearchParams(urlUpdates.at(-1)?.queryString).get("color")).toBe("rose"),
      );

      const usage = within(sidebar).getByRole("region", { name: "Де використовуються" });
      expect(within(usage).getByText("Лише в книгах")).toBeInTheDocument();
      expect(within(usage).queryAllByRole("button")).toHaveLength(0);
      expect(screen.getByRole("button", { name: "Огляд тегів" })).toBeInTheDocument();
    });
  });

  describe("Add dialog", () => {
    it("opens with custom type and parchment color, maps a duplicate name to the field", async () => {
      mockTagsApi({ "POST /api/tags": failure(409) });
      renderTags();

      await userEvent.click(screen.getByRole("button", { name: "Додати тег" }));
      const dialog = await screen.findByRole("dialog");

      expect(within(dialog).getByRole("combobox", { name: "Тип тегу" })).toHaveTextContent(
        "Власний тег",
      );
      expect(within(dialog).getByRole("radio", { name: "Пергамент" })).toBeChecked();

      await userEvent.type(within(dialog).getByLabelText("Назва тегу"), "slow burn");
      await userEvent.click(within(dialog).getByRole("button", { name: "Додати тег" }));

      expect(await within(dialog).findByText("Такий тег уже існує")).toBeInTheDocument();
      expect(within(dialog).getByLabelText("Назва тегу")).toHaveValue("slow burn");
      expect(within(dialog).getByLabelText("Назва тегу")).toHaveAttribute("aria-invalid", "true");
    });

    it("moves the color selection with the arrow keys through a single tab stop", async () => {
      mockTagsApi();
      renderTags();

      await userEvent.click(screen.getByRole("button", { name: "Додати тег" }));
      const dialog = await screen.findByRole("dialog");
      const colors = within(dialog).getByRole("radiogroup", { name: "Колір тегу" });
      const tabbable = () =>
        within(colors)
          .getAllByRole("radio")
          .filter((radio) => radio.tabIndex === 0);

      expect(tabbable()).toEqual([within(colors).getByRole("radio", { name: "Пергамент" })]);

      within(colors).getByRole("radio", { name: "Пергамент" }).focus();
      await userEvent.keyboard("{ArrowRight}");

      const terracotta = within(colors).getByRole("radio", { name: "Теракота" });
      expect(terracotta).toBeChecked();
      expect(terracotta).toHaveFocus();
      expect(tabbable()).toEqual([terracotta]);

      await userEvent.keyboard("{ArrowLeft}{ArrowLeft}");
      expect(within(colors).getByRole("radio", { name: "Пудрова троянда" })).toHaveFocus();
    });

    it("keeps the dialog open with a form-level error on an unexpected failure", async () => {
      mockTagsApi({ "POST /api/tags": failure(500) });
      renderTags();

      await userEvent.click(screen.getByRole("button", { name: "Додати тег" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.type(within(dialog).getByLabelText("Назва тегу"), "new tag");
      await userEvent.click(within(dialog).getByRole("button", { name: "Додати тег" }));

      expect(await within(dialog).findByText("Не вдалося створити тег")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("creates the tag, closes and announces Тег додано", async () => {
      mockTagsApi({ "POST /api/tags": () => json(createdTag(), 201) });
      renderTags();

      await userEvent.click(screen.getByRole("button", { name: "Додати тег" }));
      const dialog = await screen.findByRole("dialog");
      await userEvent.type(within(dialog).getByLabelText("Назва тегу"), "  found   family ");
      await userEvent.click(within(dialog).getByRole("button", { name: "Додати тег" }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Тег додано"));
      expect(requestsTo("POST /api/tags")[0]?.body).toEqual({
        color: "parchment",
        name: "found family",
        type: "custom",
      });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });

  describe("Edit dialog", () => {
    it("keeps save disabled while pristine and sends only the changed fields", async () => {
      mockTagsApi({ "PATCH /api/tags/tag-slow-burn": () => json(createdTag()) });
      renderTags();

      await openTagAction("slow burn", "Редагувати");
      const dialog = await screen.findByRole("dialog");
      const save = within(dialog).getByRole("button", { name: "Зберегти" });
      expect(save).toBeDisabled();

      await userEvent.clear(within(dialog).getByLabelText(/Опис/));
      await userEvent.type(within(dialog).getByLabelText(/Опис/), "Новий опис");
      expect(save).toBeEnabled();
      await userEvent.click(save);

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Зміни збережено"));
      expect(requestsTo("PATCH /api/tags/tag-slow-burn")[0]?.body).toEqual({
        description: "Новий опис",
      });
    });

    it("maps a duplicate name to the name field and closes on cancel without a confirm", async () => {
      mockTagsApi({ "PATCH /api/tags/tag-slow-burn": failure(409) });
      renderTags();

      await openTagAction("slow burn", "Редагувати");
      const dialog = await screen.findByRole("dialog");
      const name = within(dialog).getByLabelText("Назва тегу");
      await userEvent.clear(name);
      await userEvent.type(name, "cozy");
      await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

      expect(await within(dialog).findByText("Такий тег уже існує")).toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole("button", { name: "Скасувати" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("Delete dialog", () => {
    it("keeps confirm disabled until the preview succeeds and never falls back to row counts", async () => {
      let previewAttempts = 0;
      mockTagsApi({
        "GET /api/tags/tag-slow-burn/deletion-preview": () => {
          previewAttempts += 1;
          return previewAttempts === 1 ? failure(500)() : json(PREVIEW);
        },
      });
      renderTags();

      await openTagAction("slow burn", "Видалити");
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: "Видалити тег" });
      expect(confirm).toBeDisabled();

      expect(
        await within(dialog).findByText(/Не вдалося перевірити, де використовується тег/),
      ).toBeInTheDocument();
      expect(confirm).toBeDisabled();
      expect(within(dialog).queryByText(/Буде прибрано/)).not.toBeInTheDocument();

      await userEvent.click(within(dialog).getByRole("button", { name: "Спробувати знову" }));

      expect(
        await within(dialog).findByText("Буде прибрано звʼязки з 3 книгами"),
      ).toBeInTheDocument();
      expect(within(dialog).queryByText(/персонаж(ем|ами|а)$/)).not.toBeInTheDocument();
      expect(within(dialog).getByText("Книги залишаться у вашій бібліотеці.")).toBeInTheDocument();
      expect(within(dialog).getByText("Персонажі залишаться без змін.")).toBeInTheDocument();
      expect(within(dialog).getByText("Цю дію неможливо скасувати.")).toBeInTheDocument();
      await waitFor(() => expect(confirm).toBeEnabled());
    });

    it("keeps confirm disabled on a quick reopen until the fresh preview resolves", async () => {
      const freshPreview = deferred<Response>();
      mockTagsApi({
        "GET /api/tags/tag-slow-burn/deletion-preview": () =>
          requestsTo("GET /api/tags/tag-slow-burn/deletion-preview").length === 1
            ? json(PREVIEW)
            : freshPreview.promise,
      });
      renderTags("", undefined, productionLikeClient());
      const openDialog = async () => {
        await openTagAction("slow burn", "Видалити");
        return screen.findByRole("alertdialog");
      };

      const firstDialog = await openDialog();
      await waitFor(() =>
        expect(within(firstDialog).getByRole("button", { name: "Видалити тег" })).toBeEnabled(),
      );
      await userEvent.click(within(firstDialog).getByRole("button", { name: "Скасувати" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

      const reopened = await openDialog();
      const confirm = within(reopened).getByRole("button", { name: "Видалити тег" });
      await waitFor(() =>
        expect(requestsTo("GET /api/tags/tag-slow-burn/deletion-preview")).toHaveLength(2),
      );
      expect(confirm).toBeDisabled();

      freshPreview.resolve(
        new Response(JSON.stringify({ bookLinksCount: 1, characterLinksCount: 0 }), {
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(
        await within(reopened).findByText("Буде прибрано звʼязок із 1 книгою"),
      ).toBeInTheDocument();
      await waitFor(() => expect(confirm).toBeEnabled());
    });

    it("deletes once, closes and announces success", async () => {
      mockTagsApi({
        "DELETE /api/tags/tag-slow-burn": () =>
          Promise.resolve(new Response(null, { status: 204 })),
        "GET /api/tags/tag-slow-burn/deletion-preview": () => json(PREVIEW),
      });
      renderTags();

      await openTagAction("slow burn", "Видалити");
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: "Видалити тег" });
      await waitFor(() => expect(confirm).toBeEnabled());

      await userEvent.dblClick(confirm);

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Тег видалено"));
      expect(requestsTo("DELETE /api/tags/tag-slow-burn")).toHaveLength(1);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    });

    it("keeps the dialog open with an error when deletion fails", async () => {
      mockTagsApi({
        "DELETE /api/tags/tag-slow-burn": failure(500),
        "GET /api/tags/tag-slow-burn/deletion-preview": () => json(PREVIEW),
      });
      renderTags();

      await openTagAction("slow burn", "Видалити");
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: "Видалити тег" });
      await waitFor(() => expect(confirm).toBeEnabled());
      await userEvent.click(confirm);

      expect(
        await within(dialog).findByText("Не вдалося видалити тег. Спробуйте ще раз."),
      ).toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });
});

describe("TagsView grid and list views", () => {
  it("renders cards in a grid by default without writing a view param", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("", (event) => urlUpdates.push(event));

    await screen.findByRole("heading", { level: 3, name: "slow burn" });

    expect(screen.getByRole("radio", { name: "Сітка" })).toHaveAttribute("aria-checked", "true");
    expect(catalogList()).toHaveClass("grid", "sm:grid-cols-2");
    expect(urlUpdates).toHaveLength(0);
  });

  it("switches to the list and writes view=list while keeping the other params", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?filter=used&sort=name_asc", (event) => urlUpdates.push(event));
    await screen.findByRole("heading", { level: 3, name: "slow burn" });

    await userEvent.click(screen.getByRole("radio", { name: "Список" }));

    await waitFor(() =>
      expect(urlUpdates.at(-1)?.queryString).toBe("?filter=used&sort=name_asc&view=list"),
    );
    expect(catalogList()).not.toHaveClass("grid");
    expect(within(tagItem("slow burn")).getByText("Повільний розвиток почуттів")).toHaveClass(
      "truncate",
    );
    expect(screen.getByText("Показано 2 із 2 тегів")).toBeInTheDocument();
  });

  it("shows a skeleton that matches the active view while the first page loads", async () => {
    mockTagsApi({ "GET /api/tags/catalog": () => new Promise<Response>(() => undefined) });
    const { unmount } = renderTags();

    expect(await screen.findByRole("status", { name: "Завантажуємо теги" })).toHaveClass("grid");
    unmount();

    renderTags("?view=list");

    expect(await screen.findByRole("status", { name: "Завантажуємо теги" })).toHaveClass(
      "flex-col",
    );
  });

  it.each(["", "?view=list"])(
    "shows only books and characters counts, never a total (%s)",
    async (searchParams) => {
      mockTagsApi();
      renderTags(searchParams);
      await screen.findByRole("heading", { level: 3, name: "slow burn" });

      const item = tagItem("slow burn");
      const [booksTerm, charactersTerm] = within(item).getAllByRole("term");
      const [booksValue, charactersValue] = within(item).getAllByRole("definition");
      expect(within(item).getAllByRole("term")).toHaveLength(2);
      expect(booksTerm).toHaveTextContent("Книги");
      expect(booksValue).toHaveTextContent("3");
      expect(charactersTerm).toHaveTextContent("Персонажі");
      expect(charactersValue).toHaveTextContent("2");
      expect(within(item).getByText("Троп")).toBeInTheDocument();
      expect(screen.queryByText("Усього")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Редагувати тег/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Видалити тег/ })).not.toBeInTheDocument();
    },
  );

  it.each(["", "?view=list"])(
    "shows a neutral note instead of counts for an unused tag (%s)",
    async (searchParams) => {
      mockTagsApi();
      renderTags(searchParams);
      await screen.findByRole("heading", { level: 3, name: "cozy" });

      const item = tagItem("cozy");
      expect(within(item).getByText("Ще не використовується")).toBeInTheDocument();
      expect(within(item).queryByText("Книги")).not.toBeInTheDocument();
      expect(within(item).queryByText("Персонажі")).not.toBeInTheDocument();
    },
  );

  it("clamps a long description and a long name to two lines in the grid", async () => {
    const description = "Дуже довгий опис ".repeat(40).trim();
    const name = "дуже-довга-назва-тегу-без-пробілів-".repeat(6);
    mockTagsApi({
      "GET /api/tags/catalog": () => json(page([{ ...SLOW_BURN, description, name }])),
    });
    renderTags();

    const heading = await screen.findByRole("heading", { level: 3, name });
    expect(heading).toHaveClass("line-clamp-2", "break-words");
    expect(within(tagItem(name)).getByText(description)).toHaveClass("line-clamp-2");
  });

  it("opens the Edit and Delete dialogs from the actions menu", async () => {
    mockTagsApi({ "GET /api/tags/tag-slow-burn/deletion-preview": () => json(PREVIEW) });
    renderTags();

    await userEvent.click(await screen.findByRole("button", { name: "Дії з тегом «slow burn»" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Видалити" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Редагувати" }));

    const editDialog = await screen.findByRole("dialog");
    expect(within(editDialog).getByLabelText("Назва тегу")).toHaveValue("slow burn");
    await userEvent.click(within(editDialog).getByRole("button", { name: "Скасувати" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openTagAction("slow burn", "Видалити");

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  });

  it("opens the actions menu from the keyboard", async () => {
    mockTagsApi();
    renderTags("?view=list");
    const trigger = await screen.findByRole("button", { name: "Дії з тегом «cozy»" });

    trigger.focus();
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toBeInTheDocument();
  });
});

describe("TagsView URL state", () => {
  it("reconstructs search, quick filter, type, color and sort from a deep link", async () => {
    mockTagsApi();

    renderTags("?q=slow&filter=used&type=trope&color=rose&sort=name_asc");

    expect(await screen.findByLabelText("Пошук тегу")).toHaveValue("slow");
    expect(await quickFilter("Використовуються")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("combobox", { name: "Сортування" })).toHaveTextContent("За назвою");
    const chips = screen.getByRole("group", { name: "Активні фільтри" });
    expect(within(chips).getByText("Тропи")).toBeInTheDocument();
    expect(within(chips).getByText("Пудрова троянда")).toBeInTheDocument();
    const [request] = requestsTo("GET /api/tags/catalog");
    expect(request?.searchParams.get("q")).toBe("slow");
    expect(request?.searchParams.get("filter")).toBe("used");
    expect(request?.searchParams.getAll("type")).toEqual(["trope"]);
    expect(request?.searchParams.getAll("color")).toEqual(["rose"]);
    expect(request?.searchParams.get("sort")).toBe("name_asc");
  });

  it("pushes URL changes to history and restores URL-owned state on back and forward", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    const { rerender } = renderTags("?q=cozy", (event) => urlUpdates.push(event));

    await userEvent.click(await quickFilter("Невикористані"));
    await waitFor(() => expect(urlUpdates.at(-1)?.queryString).toBe("?q=cozy&filter=unused"));
    expect(urlUpdates.at(-1)?.options.history).toBe("push");

    rerender(
      <NuqsTestingAdapter hasMemory searchParams="?q=slow&filter=used">
        <TagsView />
      </NuqsTestingAdapter>,
    );
    await waitFor(() => expect(screen.getByLabelText("Пошук тегу")).toHaveValue("slow"));
    expect(await quickFilter("Використовуються")).toHaveAttribute("aria-checked", "true");

    rerender(
      <NuqsTestingAdapter hasMemory searchParams="?q=cozy">
        <TagsView />
      </NuqsTestingAdapter>,
    );
    await waitFor(() => expect(screen.getByLabelText("Пошук тегу")).toHaveValue("cozy"));
    expect(await quickFilter("Усі")).toHaveAttribute("aria-checked", "true");
    await waitFor(() => {
      const latest = requestsTo("GET /api/tags/catalog").at(-1);
      expect(latest?.searchParams.get("q")).toBe("cozy");
      expect(latest?.searchParams.get("filter")).toBe("all");
    });
  });
});

describe("TagsView search", () => {
  it("commits a normalized search only once 300 ms have passed", async () => {
    mockTagsApi();
    renderTags();
    await screen.findByRole("heading", { level: 3, name: "slow burn" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ delay: null });

    await settle(() => user.type(screen.getByLabelText("Пошук тегу"), "  slow   burn "));
    await act(() => vi.advanceTimersByTimeAsync(299));

    expect(catalogSearches()).toEqual([]);

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(catalogSearches()).toEqual(["slow burn"]);
  });

  it("never sends a single-character search", async () => {
    mockTagsApi();
    renderTags();
    await screen.findByRole("heading", { level: 3, name: "slow burn" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ delay: null });

    await settle(() => user.type(screen.getByLabelText("Пошук тегу"), "s"));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(catalogSearches()).toEqual([]);
    expect(screen.getByLabelText("Пошук тегу")).toHaveValue("s");
  });

  it("clears the committed search immediately without waiting for the debounce", async () => {
    mockTagsApi();
    renderTags("?q=slow&sort=name_asc");
    await screen.findByRole("heading", { level: 3, name: "slow burn" });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const user = userEvent.setup({ delay: null });

    await settle(() => user.click(screen.getByRole("button", { name: "Очистити пошук" })));
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(screen.getByLabelText("Пошук тегу")).toHaveValue("");
    const latest = requestsTo("GET /api/tags/catalog").at(-1);
    expect(latest?.searchParams.has("q")).toBe(false);
    expect(latest?.searchParams.get("sort")).toBe("name_asc");
  });

  it("keeps filters and sort and restarts paging from the first page when the search changes", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": (request) => {
        if (request.searchParams.get("q") === "cozy") return json(page([COZY]));
        return json(
          request.searchParams.get("pageNumber") === "2"
            ? page([COZY], { page: 2, pagesCount: 2, totalCount: 2 })
            : page([SLOW_BURN], { pagesCount: 2, totalCount: 2 }),
        );
      },
    });
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?type=trope&sort=name_asc", (event) => urlUpdates.push(event));
    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    expect(await screen.findByText("Показано 2 із 2 тегів")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Пошук тегу"), "cozy");

    expect(await screen.findByText("Показано 1 із 1 тегів")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "slow burn" })).not.toBeInTheDocument();
    const searched = requestsTo("GET /api/tags/catalog").filter(
      (request) => request.searchParams.get("q") === "cozy",
    );
    expect(searched.map((request) => request.searchParams.get("pageNumber"))).toEqual(["1"]);
    expect(searched[0]?.searchParams.getAll("type")).toEqual(["trope"]);
    expect(searched[0]?.searchParams.get("sort")).toBe("name_asc");
    const params = new URLSearchParams(urlUpdates.at(-1)?.queryString);
    expect(params.get("q")).toBe("cozy");
    expect(params.get("type")).toBe("trope");
    expect(params.get("sort")).toBe("name_asc");
  });
});

describe("TagsView filters and sort", () => {
  it("keeps q, type, color and sort when the quick filter changes", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?q=cozy&type=trope&color=rose&sort=name_asc", (event) => urlUpdates.push(event));

    await userEvent.click(await quickFilter("Використовуються"));

    await waitFor(() =>
      expect(urlUpdates.at(-1)?.queryString).toBe(
        "?q=cozy&type=trope&color=rose&sort=name_asc&filter=used",
      ),
    );
  });

  it("applies the type and color selected in the filters sheet to the URL", async () => {
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?filter=unused", (event) => urlUpdates.push(event));

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const sheet = await screen.findByRole("dialog", { name: "Фільтри тегів" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Теми" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Тропи" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Шавлія" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Застосувати" }));

    await waitFor(() => {
      const params = new URLSearchParams(urlUpdates.at(-1)?.queryString);
      expect(params.get("type")?.split(",").sort()).toEqual(["theme", "trope"]);
      expect(params.get("color")).toBe("sage");
      expect(params.get("filter")).toBe("unused");
    });
  });

  it("keeps filters and restarts paging from the first page when the sort changes", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": (request) => {
        if (request.searchParams.get("sort") === "name_asc") return json(page([COZY, SLOW_BURN]));
        return json(
          request.searchParams.get("pageNumber") === "2"
            ? page([COZY], { page: 2, pagesCount: 2, totalCount: 2 })
            : page([SLOW_BURN], { pagesCount: 2, totalCount: 2 }),
        );
      },
    });
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?type=trope&filter=used", (event) => urlUpdates.push(event));
    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    await screen.findByText("Показано 2 із 2 тегів");

    await userEvent.click(screen.getByRole("combobox", { name: "Сортування" }));
    await userEvent.click(await screen.findByRole("option", { name: "За назвою" }));

    await waitFor(() =>
      expect(
        requestsTo("GET /api/tags/catalog")
          .filter((request) => request.searchParams.get("sort") === "name_asc")
          .map((request) => request.searchParams.get("pageNumber")),
      ).toEqual(["1"]),
    );
    const params = new URLSearchParams(urlUpdates.at(-1)?.queryString);
    expect(params.get("sort")).toBe("name_asc");
    expect(params.get("type")).toBe("trope");
    expect(params.get("filter")).toBe("used");
  });
});

describe("TagsView progressive paging", () => {
  it("keeps the loaded rows and a busy load-more while the next page is pending", async () => {
    const nextPage = deferred<Response>();
    mockTagsApi({
      "GET /api/tags/catalog": (request) =>
        request.searchParams.get("pageNumber") === "2"
          ? nextPage.promise
          : json(page([SLOW_BURN], { pagesCount: 2, totalCount: 2 })),
    });
    renderTags();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Показати ще" })).toBeDisabled());
    expect(screen.getByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByText("Показано 1 із 2 тегів")).toBeInTheDocument();
    nextPage.resolve(await json(page([COZY], { page: 2, pagesCount: 2, totalCount: 2 })));
    expect(await screen.findByRole("heading", { level: 3, name: "cozy" })).toBeInTheDocument();
  });

  it("sends one next-page request however often load-more is pressed while pending", async () => {
    const nextPage = deferred<Response>();
    mockTagsApi({
      "GET /api/tags/catalog": (request) =>
        request.searchParams.get("pageNumber") === "2"
          ? nextPage.promise
          : json(page([SLOW_BURN], { pagesCount: 2, totalCount: 2 })),
    });
    renderTags();
    const loadMore = await screen.findByRole("button", { name: "Показати ще" });

    await userEvent.dblClick(loadMore);
    await userEvent.click(loadMore);

    expect(pageRequests("2")).toHaveLength(1);
    nextPage.resolve(await json(page([COZY], { page: 2, pagesCount: 2, totalCount: 2 })));
    expect(await screen.findByRole("heading", { level: 3, name: "cozy" })).toBeInTheDocument();
    expect(pageRequests("2")).toHaveLength(1);
  });

  it("retries a failed next page and appends it", async () => {
    let secondPageAttempts = 0;
    mockTagsApi({
      "GET /api/tags/catalog": (request) => {
        if (request.searchParams.get("pageNumber") !== "2") {
          return json(page([SLOW_BURN], { pagesCount: 2, totalCount: 2 }));
        }
        secondPageAttempts += 1;
        return secondPageAttempts === 1
          ? failure(500)()
          : json(page([COZY], { page: 2, pagesCount: 2, totalCount: 2 }));
      },
    });
    renderTags();

    await userEvent.click(await screen.findByRole("button", { name: "Показати ще" }));
    await userEvent.click(await screen.findByRole("button", { name: "Спробувати знову" }));

    expect(await screen.findByRole("heading", { level: 3, name: "cozy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByText("Показано 2 із 2 тегів")).toBeInTheDocument();
    expect(screen.queryByText("Не вдалося завантажити ще теги.")).not.toBeInTheDocument();
  });

  it("counts accumulated rows against the backend total", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": () =>
        json(page([SLOW_BURN, COZY], { pagesCount: 3, totalCount: 57 })),
    });

    renderTags();

    expect(await screen.findByText("Показано 2 із 57 тегів")).toBeInTheDocument();
  });
});

describe("TagsView loading and failure states", () => {
  it("keeps the header and shows a catalog skeleton while the first page loads", async () => {
    mockTagsApi({ "GET /api/tags/catalog": () => new Promise<Response>(() => undefined) });

    renderTags();

    expect(await screen.findByRole("status", { name: "Завантажуємо теги" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Теги" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати тег" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Пошук тегу")).not.toBeInTheDocument();
  });

  it("keeps the catalog usable while the summary is still loading", async () => {
    mockTagsApi({ "GET /api/tags/summary": () => new Promise<Response>(() => undefined) });

    renderTags();

    expect(await screen.findByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Дії з тегом «slow burn»" })).toBeEnabled();
    expect(screen.getByText("Показано 2 із 2 тегів")).toBeInTheDocument();
  });

  it("keeps the catalog usable without invented counts while facets are loading", async () => {
    mockTagsApi({
      "GET /api/tags/catalog/facets": () => new Promise<Response>(() => undefined),
    });

    renderTags();

    expect(await screen.findByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(await quickFilter("Невикористані")).toHaveTextContent(/^Невикористані$/);
    expect(await quickFilter("Усі")).toHaveTextContent(/^Усі$/);
  });

  it("shows a critical retry state when the first page fails and recovers on retry", async () => {
    let attempts = 0;
    mockTagsApi({
      "GET /api/tags/catalog": () => {
        attempts += 1;
        return attempts === 1 ? failure(500)() : json(page([SLOW_BURN, COZY]));
      },
    });
    renderTags();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити теги")).toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    expect(await screen.findByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.queryByText("Не вдалося завантажити теги")).not.toBeInTheDocument();
  });

  it("keeps the current rows visible and marked busy while new criteria load", async () => {
    const unusedPage = deferred<Response>();
    mockTagsApi({
      "GET /api/tags/catalog": (request) =>
        request.searchParams.get("filter") === "unused"
          ? unusedPage.promise
          : json(page([SLOW_BURN, COZY])),
    });
    renderTags();
    await screen.findByRole("heading", { level: 3, name: "slow burn" });

    await userEvent.click(await quickFilter("Невикористані"));

    await waitFor(() => expect(catalogList()).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("heading", { level: 3, name: "slow burn" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Завантажуємо теги" })).not.toBeInTheDocument();

    unusedPage.resolve(await json(page([COZY])));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 3, name: "slow burn" }),
      ).not.toBeInTheDocument(),
    );
    expect(catalogList()).toHaveAttribute("aria-busy", "false");
  });
});

describe("TagsView empty states", () => {
  it("opens the Add dialog from the first-use state", async () => {
    mockTagsApi({
      "GET /api/tags/catalog": () => json(page([])),
      "GET /api/tags/summary": () => json({ ...SUMMARY, totalTagsCount: 0 }),
    });
    renderTags();
    await screen.findByText("У вас ще немає тегів");

    await userEvent.click(within(catalogRegion()).getByRole("button", { name: "Додати тег" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows a contextual empty state whose Clear all resets filters but keeps sort", async () => {
    mockTagsApi({ "GET /api/tags/catalog": () => json(page([])) });
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?filter=books&sort=name_asc", (event) => urlUpdates.push(event));

    await screen.findByRole("heading", { name: "Тегів за цими умовами не знайдено" });
    expect(screen.queryByText("У вас ще немає тегів")).not.toBeInTheDocument();
    expect(screen.queryByText("Усі теги використовуються")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Очистити все" }));

    await waitFor(() => expect(urlUpdates.at(-1)?.queryString).toBe("?sort=name_asc"));
  });
});

describe("TagsView mobile overview", () => {
  it("drives the same filter handlers from the Structure and Attention tabs", async () => {
    stubNarrowViewport();
    mockTagsApi();
    const urlUpdates: UrlUpdateEvent[] = [];
    renderTags("?q=cozy", (event) => urlUpdates.push(event));

    await userEvent.click(await screen.findByRole("button", { name: "Огляд тегів" }));
    const panel = await screen.findByRole("dialog", { name: "Огляд тегів" });
    await userEvent.click(await within(panel).findByRole("radio", { name: "Структура" }));
    await userEvent.click(within(panel).getByRole("button", { name: /^Атмосфера/ }));

    await waitFor(() =>
      expect(new URLSearchParams(urlUpdates.at(-1)?.queryString).get("type")).toBe("atmosphere"),
    );

    await userEvent.click(within(panel).getByRole("radio", { name: /^Увага/ }));
    await userEvent.click(within(panel).getByRole("button", { name: "Показати невикористані" }));

    await waitFor(() => {
      const params = new URLSearchParams(urlUpdates.at(-1)?.queryString);
      expect(params.get("filter")).toBe("unused");
      expect(params.get("q")).toBe("cozy");
      expect(params.get("type")).toBe("atmosphere");
    });
  });
});

describe("TagsView mutations refresh the page", () => {
  it("refetches catalog, facets and summary after creating a tag", async () => {
    mockTagsApi({ "POST /api/tags": () => json(createdTag(), 201) });
    renderTags();
    await screen.findByRole("heading", { level: 3, name: "slow burn" });
    await waitFor(() => expect(requestsTo("GET /api/tags/summary")).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Додати тег" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Назва тегу"), "found family");
    await userEvent.click(within(dialog).getByRole("button", { name: "Додати тег" }));

    await waitFor(() => expect(aggregateRequestCounts()).toEqual([2, 2, 2]));
  });

  it("closes the Edit dialog and refetches catalog, facets and summary after saving", async () => {
    mockTagsApi({ "PATCH /api/tags/tag-slow-burn": () => json(createdTag()) });
    renderTags();
    await openTagAction("slow burn", "Редагувати");
    await waitFor(() => expect(requestsTo("GET /api/tags/summary")).toHaveLength(1));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Опис/), " і ще");

    await userEvent.click(within(dialog).getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(aggregateRequestCounts()).toEqual([2, 2, 2]));
  });

  it("removes the deleted tag once the catalog is refetched", async () => {
    let deleted = false;
    mockTagsApi({
      "DELETE /api/tags/tag-slow-burn": () => {
        deleted = true;
        return Promise.resolve(new Response(null, { status: 204 }));
      },
      "GET /api/tags/catalog": () => json(deleted ? page([COZY]) : page([SLOW_BURN, COZY])),
      "GET /api/tags/tag-slow-burn/deletion-preview": () => json(PREVIEW),
    });
    renderTags();
    await openTagAction("slow burn", "Видалити");
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Видалити тег" });
    await waitFor(() => expect(confirm).toBeEnabled());

    await userEvent.click(confirm);

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { level: 3, name: "slow burn" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { level: 3, name: "cozy" })).toBeInTheDocument();
    expect(screen.getByText("Показано 1 із 1 тегів")).toBeInTheDocument();
    await waitFor(() => expect(aggregateRequestCounts()).toEqual([2, 2, 2]));
  });
});

function aggregateRequestCounts(): number[] {
  return ["GET /api/tags/catalog", "GET /api/tags/catalog/facets", "GET /api/tags/summary"].map(
    (key) => requestsTo(key).length,
  );
}

function catalogList() {
  return within(catalogRegion()).getByRole("list");
}

function catalogRegion() {
  return screen.getByRole("region", { name: "Каталог тегів" });
}

function catalogSearches(): string[] {
  return requestsTo("GET /api/tags/catalog").flatMap((request) => {
    const q = request.searchParams.get("q");
    return q === null ? [] : [q];
  });
}

function createdTag() {
  return {
    color: "parchment",
    createdAt: "2026-09-23T10:00:00.000Z",
    description: null,
    id: "tag-new",
    lastUsedAt: null,
    name: "found family",
    normalizedName: "found family",
    type: "custom",
    updatedAt: "2026-09-23T10:00:00.000Z",
  };
}

function deferred<TValue>() {
  let resolve: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function failure(status: number) {
  return () => Promise.resolve(new Response(JSON.stringify({ message: "boom" }), { status }));
}

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function mockTagsApi(overrides: Record<string, Reply> = {}) {
  const handlers: Record<string, Reply> = {
    "GET /api/tags/catalog": () => json(page([SLOW_BURN, COZY])),
    "GET /api/tags/catalog/facets": () => json(FACETS),
    "GET /api/tags/summary": () => json(SUMMARY),
    ...overrides,
  };

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const method = init?.method ?? "GET";
      const request: RecordedRequest = {
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        method,
        path: url.pathname,
        searchParams: url.searchParams,
      };
      requests.push(request);
      const handler = handlers[`${method} ${url.pathname}`];
      return handler === undefined ? failure(404)() : handler(request);
    }),
  );
}

async function openTagAction(name: string, action: "Видалити" | "Редагувати") {
  await userEvent.click(await screen.findByRole("button", { name: `Дії з тегом «${name}»` }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

function page(
  items: TagCatalogListItem[],
  overrides: Partial<PaginatedTagCatalog> = {},
): PaginatedTagCatalog {
  return {
    items,
    page: 1,
    pagesCount: items.length === 0 ? 0 : 1,
    pageSize: 20,
    totalCount: items.length,
    ...overrides,
  };
}

function pageRequests(pageNumber: string): RecordedRequest[] {
  return requestsTo("GET /api/tags/catalog").filter(
    (request) => request.searchParams.get("pageNumber") === pageNumber,
  );
}

function productionLikeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 300_000, retry: false, staleTime: 30_000 },
    },
  });
}

function quickFilter(label: string) {
  return screen.findByRole("radio", { name: new RegExp(`^${label}`) });
}

function renderTags(
  searchParams = "",
  onUrlUpdate?: OnUrlUpdateFunction,
  queryClient?: QueryClient,
) {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <TagsView />
    </NuqsTestingAdapter>,
    { queryClient },
  );
}

function requestsTo(key: string): RecordedRequest[] {
  return requests.filter((request) => `${request.method} ${request.path}` === key);
}

async function settle<TValue>(start: () => Promise<TValue>): Promise<TValue> {
  const work = start();
  let done = false;
  void work.finally(() => {
    done = true;
  });
  while (!done) await act(() => vi.advanceTimersByTimeAsync(0));
  return work;
}

function stubNarrowViewport() {
  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: vi.fn(),
    matches: false,
    media,
    removeEventListener: vi.fn(),
  }));
}

function tagItem(name: string): HTMLElement {
  const item = within(catalogList())
    .getAllByRole("listitem")
    .find((candidate) => within(candidate).queryByRole("heading", { level: 3, name }) !== null);
  if (item === undefined) throw new Error(`No catalog item for ${name}`);
  return item;
}

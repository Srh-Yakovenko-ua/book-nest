import "@testing-library/jest-dom/vitest";

import type { PublisherView } from "@app/shared";
import type { ReactNode } from "react";

import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { MergePublisherDialog } from "./merge-publisher-dialog";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const SOURCE = { id: "publisher-1", name: "Vivat" };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToMerge: () => Promise<Response>;
let searchResults: PublisherView[];

function confirmButton(): HTMLElement {
  return screen.getByRole("button", { name: /^Обʼєдна/ });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function makePublisherView(overrides: Partial<PublisherView> = {}): PublisherView {
  return {
    countryCode: "UA",
    foundedYear: null,
    id: "publisher-2",
    isCustom: false,
    logoAttribution: null,
    logoLicense: null,
    logoLicenseUrl: null,
    logoUrl: null,
    name: "КСД",
    websiteUrl: null,
    ...overrides,
  };
}

function MergeHarness() {
  const [open, setOpen] = useState(true);
  return (
    <MergePublisherDialog
      booksCount={3}
      onCloseAutoFocus={vi.fn()}
      onOpenChange={setOpen}
      open={open}
      publisherId={SOURCE.id}
      publisherName={SOURCE.name}
    />
  );
}

function mergeRequestBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([, init]) => init?.method?.toUpperCase() === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

async function pickTarget(name: string) {
  await userEvent.click(await screen.findByText(name));
  await waitFor(() => expect(confirmButton()).toBeEnabled());
}

function renderDialog() {
  return renderWithProviders(<MergeHarness />);
}

beforeEach(() => {
  searchResults = [
    makePublisherView(),
    makePublisherView({ id: SOURCE.id, isCustom: true, name: SOURCE.name }),
  ];
  respondToMerge = () =>
    Promise.resolve(jsonResponse({ movedBooksCount: 3, targetPublisherId: "publisher-2" }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (init?.method?.toUpperCase() === "POST") return respondToMerge();
    if (url.includes("/api/publishers")) {
      return Promise.resolve(
        jsonResponse({
          items: searchResults,
          page: 1,
          pagesCount: 1,
          pageSize: 20,
          totalCount: searchResults.length,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("MergePublisherDialog", () => {
  it("shows the source publisher and keeps it out of the target results", async () => {
    renderDialog();

    const source = screen.getByText("Що обʼєднуємо").closest("section");
    expect(source).not.toBeNull();
    expect(source).toHaveTextContent("Vivat");
    expect(source).toHaveTextContent("Власне");
    expect(source).toHaveTextContent("3 книги у бібліотеці");

    expect(await screen.findByText("КСД")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Vivat")).toHaveLength(1));
  });

  it("keeps the confirm disabled until a target is picked and previews the move", async () => {
    renderDialog();

    expect(confirmButton()).toBeDisabled();
    expect(screen.queryByText("Після обʼєднання")).not.toBeInTheDocument();

    await pickTarget("КСД");

    expect(screen.getByText("Усі привʼязані книги буде перенесено до «КСД».")).toBeInTheDocument();
  });

  it("submits a pending merge only once", async () => {
    let releaseMerge = () => {};
    respondToMerge = () =>
      new Promise<Response>((resolve) => {
        releaseMerge = () =>
          resolve(jsonResponse({ movedBooksCount: 3, targetPublisherId: "publisher-2" }));
      });

    renderDialog();
    await pickTarget("КСД");

    await userEvent.click(confirmButton());
    await waitFor(() => expect(confirmButton()).toBeDisabled());
    await userEvent.click(confirmButton());

    expect(mergeRequestBodies()).toHaveLength(1);
    releaseMerge();
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("confirms the merge, reports it and navigates to the target publisher", async () => {
    renderDialog();
    await pickTarget("КСД");

    await userEvent.click(confirmButton());

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Видавництва обʼєднано. Перенесено 3 книги"),
    );
    expect(mergeRequestBodies()).toEqual([{ targetPublisherId: "publisher-2" }]);
    expect(replaceMock).toHaveBeenCalledWith("/publishers/publisher-2");
  });

  it.each([
    {
      body: { code: "PUBLISHER_MERGE_SAME_PUBLISHER", message: "same" },
      message: "Не можна обʼєднати видавництво саме з собою. Обери інше.",
      status: 400,
    },
    {
      body: null,
      message:
        "Це видавництво із загального каталогу, тому обʼєднати його не можна. Обʼєднувати можна лише власні видавництва.",
      status: 403,
    },
    {
      body: { message: "Publisher not found" },
      message: "Одного з видавництв уже немає. Онови сторінку та спробуй ще раз.",
      status: 404,
    },
    {
      body: { code: "PUBLISHER_HAS_BOOKS", message: "linked" },
      message:
        "До видавництва досі привʼязані книги, тому обʼєднання скасовано. Нічого не змінилося — спробуй ще раз.",
      status: 409,
    },
    {
      body: { message: "boom" },
      message: "Не вдалося обʼєднати видавництва. Спробуй ще раз.",
      status: 500,
    },
  ])("explains a $status failure inside the dialog", async ({ body, message, status }) => {
    respondToMerge = () =>
      Promise.resolve(body === null ? new Response(null, { status }) : jsonResponse(body, status));

    renderDialog();
    await pickTarget("КСД");

    await userEvent.click(confirmButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

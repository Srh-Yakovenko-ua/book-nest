import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherDetail, PublisherDuplicateCandidate } from "@app/shared";
import type { ReactNode } from "react";

import { useState } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test-utils";

import { publisherKeys } from "../api/publisher-keys";
import { makePublisherDetail } from "../model/publisher.fixtures";
import { EditPublisherDialog } from "./edit-publisher-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let duplicateCandidates: PublisherDuplicateCandidate[];
let respondToUpdate: () => Response;

function EditHarness({ details }: { details: LibraryPublisherDetail }) {
  const [open, setOpen] = useState(true);
  return (
    <EditPublisherDialog
      details={details}
      onCloseAutoFocus={vi.fn()}
      onOpenChange={setOpen}
      open={open}
    />
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function lastPatchBody(): unknown {
  const patchCall = fetchMock.mock.calls
    .filter(([, init]) => init?.method?.toUpperCase() === "PATCH")
    .at(-1);
  return JSON.parse(String(patchCall?.[1]?.body));
}

function renderDialog(details = makePublisherDetail({ isCustom: true, name: "Vivat" })) {
  return renderWithProviders(<EditHarness details={details} />);
}

beforeEach(() => {
  duplicateCandidates = [];
  respondToUpdate = () => jsonResponse(makePublisherDetail({ isCustom: true, name: "Vivat" }));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH") return Promise.resolve(respondToUpdate());
    if (String(input).includes("/api/publishers/duplicate-candidates")) {
      return Promise.resolve(jsonResponse(duplicateCandidates));
    }
    return Promise.reject(new Error(`unexpected ${method} ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditPublisherDialog", () => {
  it("prefills the form with the publisher details", () => {
    renderDialog();

    expect(screen.getByRole("heading", { name: "Редагувати видавництво" })).toBeInTheDocument();
    expect(screen.getByLabelText("Назва")).toHaveValue("Vivat");
  });

  it("requires a name before saving", async () => {
    renderDialog();

    await userEvent.clear(screen.getByLabelText("Назва"));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Назва має містити щонайменше 2 символи")).toBeInTheDocument();
  });

  it("surfaces a duplicate name as a field error on a 409", async () => {
    respondToUpdate = () => jsonResponse({ message: "duplicate" }, 409);

    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    expect(await screen.findByText("Видавництво з такою назвою вже існує")).toBeInTheDocument();
  });

  it("names the publisher whose alias already answers to the typed name", async () => {
    duplicateCandidates = [
      {
        id: "publisher-2",
        isCustom: false,
        matchedName: "Vivat Books",
        matchKind: "alias",
        name: "Видавництво Vivat",
      },
    ];

    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва"), " Books");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Цю назву вже використовує видавництво «Видавництво Vivat», бо воно також відоме як «Vivat Books»",
    );
    const candidatesUrl = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes("/api/publishers/duplicate-candidates"));
    expect(candidatesUrl).toContain("excludePublisherId=publisher-1");
  });

  it("names the publisher that holds the typed name outright", async () => {
    duplicateCandidates = [
      {
        id: "publisher-2",
        isCustom: false,
        matchedName: "Vivat Books",
        matchKind: "exact",
        name: "Vivat Books",
      },
    ];

    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва"), " Books");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Цю назву вже використовує видавництво «Vivat Books»",
    );
    expect(screen.queryByText(/також відоме як/)).not.toBeInTheDocument();
  });

  it("stays quiet when only a fuzzy match came back", async () => {
    duplicateCandidates = [
      {
        id: "publisher-2",
        isCustom: false,
        matchedName: null,
        matchKind: "strong",
        name: "Vivat Books",
      },
    ];

    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва"), " Books");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls
          .map(([input]) => String(input))
          .some((url) => url.includes("/api/publishers/duplicate-candidates")),
      ).toBe(true),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("confirms a successful save with a toast", async () => {
    renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Видавництво оновлено"));
  });

  it("asks to discard unsaved changes when closing a dirty form", async () => {
    renderDialog();

    await userEvent.type(screen.getByLabelText("Назва"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Скасувати" }));

    expect(await screen.findByText("Відхилити зміни?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Так, вийти" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Продовжити редагування" })).toBeInTheDocument();
  });
  it("omits an unchanged legacy country code from the payload", async () => {
    renderDialog(makePublisherDetail({ countryCode: "XX", name: "Vivat" }));

    await userEvent.type(screen.getByLabelText("Назва"), " Plus");
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    const body = lastPatchBody();
    expect(body).toMatchObject({ name: "Vivat Plus" });
    expect(body).not.toHaveProperty("countryCode");
  });

  it("sends a country picked through the searchable select", async () => {
    renderDialog(makePublisherDetail({ countryCode: null }));

    await userEvent.click(screen.getByRole("combobox", { name: /Країна/ }));
    await userEvent.type(screen.getByPlaceholderText("Пошук країни"), "Польща");
    await userEvent.click(await screen.findByRole("option", { name: "Польща" }));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(lastPatchBody()).toMatchObject({ countryCode: "PL" });
  });

  it("sends null when the country is cleared", async () => {
    renderDialog(makePublisherDetail({ countryCode: "UA" }));

    await userEvent.click(screen.getByRole("button", { name: "Очистити країну" }));
    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(lastPatchBody()).toMatchObject({ countryCode: null });
  });

  it("puts the returned detail into the cache after saving", async () => {
    const updated = makePublisherDetail({ name: "Vivat Renamed" });
    respondToUpdate = () => jsonResponse(updated);

    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(publisherKeys.detail("publisher-1"), { gcTime: Infinity });
    renderWithProviders(<EditHarness details={makePublisherDetail()} />, { queryClient });

    await userEvent.click(screen.getByRole("button", { name: "Зберегти" }));

    await waitFor(() =>
      expect(queryClient.getQueryData(publisherKeys.detail("publisher-1"))).toEqual(updated),
    );
  });
});

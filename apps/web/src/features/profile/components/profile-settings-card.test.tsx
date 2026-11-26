import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { makeProfile } from "../model/profile.fixtures";
import { ProfileSettingsCard } from "./profile-settings-card";

const copy = messages.profile;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToProfile: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openEditDialog(): Promise<HTMLElement> {
  renderWithProviders(<ProfileSettingsCard />);
  await userEvent.click(await screen.findByRole("button", { name: copy.editAction }));
  return screen.findByRole("dialog", { name: copy.dialog.title });
}

beforeEach(() => {
  respondToProfile = () => Promise.resolve(jsonResponse(makeProfile()));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/profile") && method === "GET") return respondToProfile();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ProfileSettingsCard", () => {
  it("shows the name and email of the profile", async () => {
    renderWithProviders(<ProfileSettingsCard />);

    expect(await screen.findByText("Olena Petrenko")).toBeInTheDocument();
    expect(screen.getByText("olena@book.nest")).toBeInTheDocument();
  });

  it("falls back to the initials of the name without an avatar", async () => {
    renderWithProviders(<ProfileSettingsCard />);

    expect(await screen.findByText("OP")).toBeInTheDocument();
  });

  it("announces the profile while it loads", () => {
    respondToProfile = () => new Promise<Response>(() => {});

    renderWithProviders(<ProfileSettingsCard />);

    expect(screen.getByRole("status")).toHaveTextContent(copy.loading);
  });

  it("raises an alert with a retry when the profile fails to load", async () => {
    respondToProfile = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<ProfileSettingsCard />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy.loadError.title);
    expect(within(alert).getByRole("button", { name: copy.loadError.retry })).toBeInTheDocument();
  });

  it("shows the profile once the retry succeeds", async () => {
    respondToProfile = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));
    renderWithProviders(<ProfileSettingsCard />);
    const alert = await screen.findByRole("alert");

    respondToProfile = () => Promise.resolve(jsonResponse(makeProfile()));
    await userEvent.click(within(alert).getByRole("button", { name: copy.loadError.retry }));

    expect(await screen.findByText("Olena Petrenko")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ProfileSettingsCard edit dialog", () => {
  it("opens a dialog named after the edit action", async () => {
    const dialog = await openEditDialog();

    expect(dialog).toBeInTheDocument();
  });

  it("prefills the fields with the profile", async () => {
    const dialog = await openEditDialog();

    expect(within(dialog).getByRole("textbox", { name: copy.fields.name })).toHaveValue(
      "Olena Petrenko",
    );
    expect(within(dialog).getByRole("textbox", { name: copy.fields.nickname })).toHaveValue(
      "olena_reads",
    );
    expect(within(dialog).getByRole("textbox", { name: copy.fields.bio })).toHaveValue(
      "Reads fantasy at night.",
    );
  });

  it("leaves the nickname and bio empty when the profile has none", async () => {
    respondToProfile = () =>
      Promise.resolve(jsonResponse(makeProfile({ bio: null, nickname: null })));

    const dialog = await openEditDialog();

    expect(within(dialog).getByRole("textbox", { name: copy.fields.nickname })).toHaveValue("");
    expect(within(dialog).getByRole("textbox", { name: copy.fields.bio })).toHaveValue("");
  });

  it("shows the email as read-only text", async () => {
    const dialog = await openEditDialog();

    expect(within(dialog).getByText("olena@book.nest")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("textbox")).toHaveLength(3);
    expect(
      within(dialog).queryByRole("textbox", { name: copy.fields.email }),
    ).not.toBeInTheDocument();
  });
});

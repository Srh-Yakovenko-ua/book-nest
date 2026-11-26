import "@testing-library/jest-dom/vitest";

import type { UserView } from "@app/shared";
import type { ComponentProps } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/features/auth";
import { makeProfile } from "@/features/profile/model/profile.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { SessionMenu } from "./session-menu";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const profileCopy = messages.profile;
const sessionCopy = messages.auth.session;

const sessionUser = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "olena@book.nest",
  emailVerified: true,
  id: "3f9b1c2d-4e5a-4b6c-8d7e-9f0a1b2c3d4e",
  name: "Olena Petrenko",
  nickname: "olena_reads",
  role: "user",
} satisfies UserView;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

async function openAccountMenu(): Promise<HTMLElement> {
  renderWithProviders(<SessionMenu />);
  await userEvent.click(screen.getByRole("button", { name: sessionCopy.accountMenu }));
  return screen.findByRole("menu");
}

beforeEach(() => {
  useAuthStore.getState().setSession("access-token", sessionUser);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/profile") && method === "GET")
      return Promise.resolve(jsonResponse(makeProfile()));
    if (url.endsWith("/api/auth/logout") && method === "POST")
      return Promise.resolve(jsonResponse({ status: "logged_out" }));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SessionMenu", () => {
  it("lists the profile edit item above sign out", async () => {
    const menu = await openAccountMenu();

    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([profileCopy.editAction, sessionCopy.signOut]);
  });

  it("opens the profile edit dialog from the menu", async () => {
    const menu = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: profileCopy.editAction }));
    const dialog = await screen.findByRole("dialog", { name: profileCopy.dialog.title });

    expect(
      await within(dialog).findByRole("textbox", { name: profileCopy.fields.name }),
    ).toHaveValue("Olena Petrenko");
  });

  it("signs out from the menu", async () => {
    const menu = await openAccountMenu();

    await userEvent.click(within(menu).getByRole("menuitem", { name: sessionCopy.signOut }));

    expect(await screen.findByRole("link", { name: messages.auth.login.cta })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/logout"),
      expect.objectContaining({ method: "POST" }),
    );
  });
});

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { LoginForm } from "./login-form";

const auth = messages.auth;
const fetchMock = vi.fn();

function jsonResponse(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && url.endsWith("/api/auth/login")) {
      return Promise.resolve(
        jsonResponse(403, { code: "email_not_verified", message: "Email not verified" }),
      );
    }
    if (init?.method === "POST" && url.endsWith("/api/auth/resend-verification")) {
      return Promise.resolve(
        jsonResponse(429, { message: "ThrottlerException: Too Many Requests" }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("explains a throttled verification resend inside the login banner", async () => {
    renderWithProviders(<LoginForm />);

    await userEvent.type(screen.getByLabelText(auth.fields.email), "reader@example.com");
    await userEvent.type(screen.getByLabelText(auth.fields.password), "Secret-123");
    await userEvent.click(screen.getByRole("button", { name: auth.login.cta }));
    await userEvent.click(await screen.findByRole("button", { name: auth.resend.cta }));

    expect(
      await within(screen.getByRole("alert")).findByText(auth.errors.tooManyAttempts),
    ).toBeInTheDocument();
  });
});

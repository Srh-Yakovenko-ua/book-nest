import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import type { AuthResultView } from "@app/shared";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, within } from "@/test-utils";

import { VerifyEmailScreen } from "./verify-email-screen";

const auth = messages.auth;
const VERIFY_PATH = "/api/auth/verify-email";
const REJECTED_TOKEN = "expired-verification-token";
const ACCEPTED_TOKEN = "fresh-verification-token";

const INVALID_LINKS = [
  { label: "an empty token", token: "" },
  { label: "a token the server rejects", token: REJECTED_TOKEN },
] as const;

const VERIFIED_SESSION = {
  accessToken: "verified-access-token",
  user: {
    createdAt: "2026-11-01T09:00:00.000Z",
    dateOfBirth: null,
    email: "reader@example.com",
    emailVerified: true,
    id: "11111111-1111-4111-8111-111111111111",
    name: "Reader",
    nickname: null,
    role: "user",
  },
} satisfies AuthResultView;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let respondToVerify: () => Promise<Response>;

function jsonResponse(body: unknown, status: number): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function verifyRequestBodies(): unknown[] {
  return fetchMock.mock.calls
    .filter(([input]) => new URL(String(input), "http://localhost").pathname === VERIFY_PATH)
    .map(([, init]): unknown => JSON.parse(String(init?.body)));
}

beforeEach(() => {
  respondToVerify = () => jsonResponse({ message: "Invalid or expired token" }, 400);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = String(init?.method ?? "GET").toUpperCase();
    if (method === "POST" && pathname === VERIFY_PATH) {
      return respondToVerify();
    }
    return Promise.reject(new Error(`unexpected fetch: ${method} ${pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("VerifyEmailScreen invalid link", () => {
  it.each(INVALID_LINKS)("tells the reader the link is invalid for $label", async ({ token }) => {
    renderWithProviders(<VerifyEmailScreen token={token} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(auth.errors.invalidToken);
  });

  it.each(INVALID_LINKS)("shows the expired-hourglass art for $label", async ({ token }) => {
    renderWithProviders(<VerifyEmailScreen token={token} />);

    await screen.findByRole("alert");
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("goal-expired-hourglass.png"),
    );
  });

  it("does not ask the server to verify an empty token", async () => {
    renderWithProviders(<VerifyEmailScreen token="" />);

    await screen.findByRole("alert");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the link token to the server before reporting it invalid", async () => {
    renderWithProviders(<VerifyEmailScreen token={REJECTED_TOKEN} />);

    await screen.findByRole("alert");
    expect(verifyRequestBodies()).toEqual([{ token: REJECTED_TOKEN }]);
  });
});

describe("VerifyEmailScreen verified link", () => {
  it("shows the email-verified art next to the success heading", async () => {
    respondToVerify = () => jsonResponse(VERIFIED_SESSION, 200);
    renderWithProviders(<VerifyEmailScreen token={ACCEPTED_TOKEN} />);

    await screen.findByRole("heading", { name: auth.verify.success });
    const announcement = screen.getByRole("status");
    expect(
      within(announcement).getByRole("heading", { name: auth.verify.success }),
    ).toBeInTheDocument();
    expect(within(announcement).getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("email-verified.png"),
    );
  });
});

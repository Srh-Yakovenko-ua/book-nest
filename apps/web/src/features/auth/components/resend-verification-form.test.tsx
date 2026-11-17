import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { ResendVerificationForm } from "./resend-verification-form";

const auth = messages.auth;
const fetchMock = vi.fn();

function answerResend(status: number, body: object) {
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith("/api/auth/resend-verification") && init?.method === "POST") {
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
          status,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
}

async function requestResend() {
  renderWithProviders(<ResendVerificationForm />);
  await userEvent.type(screen.getByLabelText(auth.fields.email), "reader@example.com");
  await userEvent.click(screen.getByRole("button", { name: auth.resend.cta }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ResendVerificationForm", () => {
  it("confirms the verification email was sent", async () => {
    answerResend(200, { cooldownSeconds: 60, status: "verification_sent" });

    await requestResend();

    expect(await screen.findByRole("alert")).toHaveTextContent(auth.resend.success);
  });

  it("asks the reader to wait when resending is rate limited", async () => {
    answerResend(429, { message: "ThrottlerException: Too Many Requests" });

    await requestResend();

    expect(await screen.findByRole("alert")).toHaveTextContent(auth.errors.tooManyAttempts);
  });

  it("reports the service as unavailable when the server fails", async () => {
    answerResend(500, { message: "Internal server error" });

    await requestResend();

    expect(await screen.findByRole("alert")).toHaveTextContent(auth.errors.serviceUnavailable);
  });

  it("reports the service as unavailable when the network is down", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await requestResend();

    expect(await screen.findByRole("alert")).toHaveTextContent(auth.errors.serviceUnavailable);
  });
});

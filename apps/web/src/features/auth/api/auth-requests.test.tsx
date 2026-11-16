import type {
  ForgotPasswordInput,
  LoginInput,
  RegistrationInput,
  ResendVerificationInput,
  ResetPasswordInput,
  UserView,
  VerifyEmailInput,
} from "@app/shared";
import type { ReactNode } from "react";

import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerAuthBridge } from "@/lib/auth-bridge";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http-client";
import { createTestQueryClient } from "@/test-utils";

import { useAuthStore } from "../model/auth-store";
import { logout, refreshSession } from "./session";
import { useForgotPassword } from "./use-forgot-password";
import { useLogin } from "./use-login";
import { useRegister } from "./use-register";
import { useResendVerification } from "./use-resend-verification";
import { useResetPassword } from "./use-reset-password";
import { useVerifyEmail } from "./use-verify-email";

const paths = {
  forgotPassword: "/api/auth/forgot-password",
  login: "/api/auth/login",
  logout: "/api/auth/logout",
  refresh: "/api/auth/refresh",
  registration: "/api/auth/registration",
  resendVerification: "/api/auth/resend-verification",
  resetPassword: "/api/auth/reset-password",
  verifyEmail: "/api/auth/verify-email",
};

const inputs = {
  forgotPassword: { email: "reader@book.nest" } satisfies ForgotPasswordInput,
  login: {
    email: "reader@book.nest",
    password: "Secret-pass1",
    rememberMe: true,
  } satisfies LoginInput,
  registration: {
    email: "reader@book.nest",
    name: "Reader",
    password: "Secret-pass1",
  } satisfies RegistrationInput,
  resendVerification: { email: "reader@book.nest" } satisfies ResendVerificationInput,
  resetPassword: { password: "Secret-pass1", token: "reset-token" } satisfies ResetPasswordInput,
  verifyEmail: { token: "verify-token" } satisfies VerifyEmailInput,
};

const reader: UserView = {
  createdAt: "2026-01-01T00:00:00.000Z",
  dateOfBirth: null,
  email: "reader@book.nest",
  emailVerified: true,
  id: "user-1",
  name: "Reader",
  nickname: null,
  role: "user",
};

const authResult = { accessToken: "access-token-1", user: reader };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function apiUrl(path: string): string {
  return `${env.NEXT_PUBLIC_API_BASE_URL}${path}`;
}

function expectedJsonPost(path: string, body: unknown) {
  return {
    body,
    contentType: "application/json",
    credentials: "include",
    method: "POST",
    url: apiUrl(path),
  };
}

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function parseJsonBody(body: RequestInit["body"]): unknown {
  return typeof body === "string" ? JSON.parse(body) : body;
}

function respondAt(path: string, body: unknown, status = 200): void {
  fetchMock.mockImplementation((input) => {
    if (String(input) !== apiUrl(path)) {
      return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
    }
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
        status,
      }),
    );
  });
}

async function sendThrough<TInput, TResult>(
  useMutationHook: () => { mutateAsync: (input: TInput) => Promise<TResult> },
  input: TInput,
): Promise<TResult> {
  const { result } = renderHook(useMutationHook, {
    wrapper: makeWrapper(createTestQueryClient()),
  });
  return await act(async () => result.current.mutateAsync(input));
}

function sentRequests() {
  return fetchMock.mock.calls.map(([input, init]) => ({
    body: parseJsonBody(init?.body),
    contentType: new Headers(init?.headers).get("Content-Type"),
    credentials: init?.credentials,
    method: init?.method,
    url: String(input),
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useAuthStore.setState(useAuthStore.getInitialState(), true);
  registerAuthBridge({
    getAccessToken: () => null,
    onRefreshFailed: () => {},
    refresh: () => Promise.resolve("refreshed-access-token"),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useLogin", () => {
  it("posts the credentials as JSON to the login endpoint with cookies included", async () => {
    respondAt(paths.login, authResult);

    await sendThrough(useLogin, inputs.login);

    expect(sentRequests()).toEqual([expectedJsonPost(paths.login, inputs.login)]);
  });

  it("stores the returned access token and user as the session", async () => {
    respondAt(paths.login, authResult);

    await sendThrough(useLogin, inputs.login);

    expect(useAuthStore.getState()).toMatchObject(authResult);
  });

  it("fails a rejected login with a 401 ApiError, no refresh attempt and no session", async () => {
    respondAt(paths.login, { message: "Invalid email or password" }, 401);

    const failure = await sendThrough(useLogin, inputs.login).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, user: null });
  });
});

describe("useVerifyEmail", () => {
  it("posts the verification token as JSON to the verify-email endpoint", async () => {
    respondAt(paths.verifyEmail, authResult);

    await sendThrough(useVerifyEmail, inputs.verifyEmail);

    expect(sentRequests()).toEqual([expectedJsonPost(paths.verifyEmail, inputs.verifyEmail)]);
  });

  it("stores the session returned for a verified email", async () => {
    respondAt(paths.verifyEmail, authResult);

    await sendThrough(useVerifyEmail, inputs.verifyEmail);

    expect(useAuthStore.getState()).toMatchObject(authResult);
  });
});

describe("status mutations", () => {
  const statusMutations = [
    {
      hook: "useRegister",
      input: inputs.registration,
      path: paths.registration,
      response: { email: "reader@book.nest", status: "verification_sent" },
      send: () => sendThrough(useRegister, inputs.registration),
    },
    {
      hook: "useForgotPassword",
      input: inputs.forgotPassword,
      path: paths.forgotPassword,
      response: { status: "reset_email_sent" },
      send: () => sendThrough(useForgotPassword, inputs.forgotPassword),
    },
    {
      hook: "useResetPassword",
      input: inputs.resetPassword,
      path: paths.resetPassword,
      response: { status: "password_reset" },
      send: () => sendThrough(useResetPassword, inputs.resetPassword),
    },
    {
      hook: "useResendVerification",
      input: inputs.resendVerification,
      path: paths.resendVerification,
      response: { status: "verification_sent" },
      send: () => sendThrough(useResendVerification, inputs.resendVerification),
    },
  ];

  it.each(statusMutations)(
    "$hook posts its input as JSON to $path",
    async ({ input, path, response, send }) => {
      respondAt(path, response);

      await send();

      expect(sentRequests()).toEqual([expectedJsonPost(path, input)]);
    },
  );

  it.each(statusMutations)(
    "$hook resolves to the parsed response body",
    async ({ path, response, send }) => {
      respondAt(path, response);

      await expect(send()).resolves.toEqual(response);
    },
  );
});

describe("session", () => {
  it("logout posts to the logout endpoint with cookies included", async () => {
    respondAt(paths.logout, { status: "logged_out" });

    await logout();

    expect(sentRequests()).toEqual([
      {
        body: undefined,
        contentType: "application/json",
        credentials: "include",
        method: "POST",
        url: apiUrl(paths.logout),
      },
    ]);
  });

  it("logout resolves to the logged-out status", async () => {
    respondAt(paths.logout, { status: "logged_out" });

    await expect(logout()).resolves.toEqual({ status: "logged_out" });
  });

  it("refreshSession posts to the refresh endpoint with cookies included", async () => {
    respondAt(paths.refresh, authResult);

    await refreshSession();

    expect(sentRequests()).toEqual([
      {
        body: undefined,
        contentType: "application/json",
        credentials: "include",
        method: "POST",
        url: apiUrl(paths.refresh),
      },
    ]);
  });

  it("refreshSession resolves to the parsed auth result", async () => {
    respondAt(paths.refresh, authResult);

    await expect(refreshSession()).resolves.toEqual(authResult);
  });

  it("refreshSession rejects a 401 without retrying the refresh", async () => {
    respondAt(paths.refresh, { message: "Refresh token expired" }, 401);

    await expect(refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

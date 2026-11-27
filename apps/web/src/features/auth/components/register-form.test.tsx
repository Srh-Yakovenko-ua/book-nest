import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { renderWithProviders, screen } from "@/test-utils";

import { RegisterForm } from "./register-form";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) =>
    Promise.reject(new Error(`unexpected fetch: ${String(input)}`)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RegisterForm", () => {
  it("keeps the terms consent sentence in one inline run inside the label", () => {
    renderWithProviders(<RegisterForm />);

    const termsLink = screen.getByRole("link", { name: "умови використання" });
    const privacyLink = screen.getByRole("link", { name: "політику конфіденційності" });
    const sentence = termsLink.parentElement;

    expect(privacyLink.parentElement).toBe(sentence);
    expect(sentence?.tagName).not.toBe("LABEL");
    expect(sentence?.textContent).toBe("Я приймаю умови використання та політику конфіденційності");
  });
});

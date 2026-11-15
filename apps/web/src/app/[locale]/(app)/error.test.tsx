import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import AppError from "./error";

const copy = messages.error;

function showAppError() {
  const reset = vi.fn();
  renderWithProviders(<AppError error={new Error("secret SQL detail")} reset={reset} />);
  return { reset };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("app shell error boundary", () => {
  it("shows the translated headline and description inside the main landmark", () => {
    showAppError();

    const main = screen.getByRole("main");
    expect(within(main).getByRole("heading", { level: 1 })).toHaveTextContent(copy.headline);
    expect(within(main).getByText(copy.description)).toBeInTheDocument();
  });

  it("offers a way back to the home page", () => {
    showAppError();

    expect(screen.getByRole("link", { name: copy.backHome })).toHaveAttribute("href", "/");
  });

  it("never shows the error message to the user", () => {
    showAppError();

    expect(screen.queryByText(/secret SQL detail/)).not.toBeInTheDocument();
  });

  it("moves focus to the headline", () => {
    showAppError();

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("calls reset once when retry is clicked", async () => {
    const { reset } = showAppError();

    await userEvent.click(screen.getByRole("button", { name: copy.reload }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

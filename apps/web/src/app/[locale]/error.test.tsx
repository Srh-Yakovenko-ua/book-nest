import type { ReactNode } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import RouteError from "./error";

const copy = messages.error;

function showRouteError() {
  const reset = vi.fn();
  const failure = new Error("secret SQL detail");
  renderWithProviders(<RouteError error={failure} reset={reset} />);
  return { reset };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("route error boundary", () => {
  it("never shows the error message to the user", () => {
    showRouteError();

    expect(screen.queryByText(/secret SQL detail/)).not.toBeInTheDocument();
  });

  it("shows the translated description", () => {
    showRouteError();

    expect(screen.getByText(copy.description)).toBeInTheDocument();
  });

  it("shows the generic error illustration", () => {
    showRouteError();

    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("error-generic.png"),
    );
  });

  it("shows no untranslated debug labels", () => {
    showRouteError();

    expect(screen.queryByText(/runtime error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/stack trace/i)).not.toBeInTheDocument();
  });

  it("calls reset once when retry is clicked", async () => {
    const { reset } = showRouteError();

    await userEvent.click(screen.getByRole("button", { name: copy.reload }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("titles the document with the headline and the app name", async () => {
    showRouteError();

    await waitFor(() => expect(document.title).toBe(`${copy.headline} · ${messages.home.title}`));
  });

  it("moves focus to the headline", () => {
    showRouteError();

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted((): { params: Record<string, string> } => ({ params: {} }));

vi.mock("next/navigation", () => ({
  useParams: () => route.params,
}));

import en from "@/messages/global-error/en.json";
import uk from "@/messages/global-error/uk.json";
import { render, screen, userEvent } from "@/test-utils";

import GlobalError from "./global-error";

function showGlobalError(params: Record<string, string>) {
  route.params = params;
  const reset = vi.fn();
  const failure = new Error("root layout exploded");
  render(<GlobalError error={failure} reset={reset} />, { container: document });
  return { reset };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("global error boundary", () => {
  it("renders in English when the route locale is en", () => {
    showGlobalError({ locale: "en" });

    expect(screen.getByText(en.headline)).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
  });

  it.each<{ label: string; params: Record<string, string> }>([
    { label: "uk", params: { locale: "uk" } },
    { label: "unsupported", params: { locale: "fr" } },
    { label: "missing", params: {} },
  ])("renders in Ukrainian when the route locale is $label", ({ params }) => {
    showGlobalError(params);

    expect(screen.getByText(uk.headline)).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "uk");
  });

  it("calls reset once when reload is clicked", async () => {
    const { reset } = showGlobalError({ locale: "en" });

    await userEvent.click(screen.getByRole("button", { name: en.reload }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});

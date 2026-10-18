import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { TruncatedText } from "./truncated-text";

const LONG_TEXT = "Розділ дванадцятий: повернення до Арракіса крізь пустелю";

const BOX_METRICS = ["clientHeight", "clientWidth", "scrollHeight", "scrollWidth"] as const;

let restoreMetrics: () => void = () => undefined;

function stubBoxMetrics(metrics: Record<(typeof BOX_METRICS)[number], number>) {
  const originals = BOX_METRICS.map(
    (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
  );

  for (const name of BOX_METRICS) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get: () => metrics[name],
    });
  }

  restoreMetrics = () => {
    for (const [name, descriptor] of originals) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(HTMLElement.prototype, name);
        continue;
      }
      Object.defineProperty(HTMLElement.prototype, name, descriptor);
    }
  };
}

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("TruncatedText", () => {
  it("clips to a single line by default", () => {
    renderWithProviders(<TruncatedText text={LONG_TEXT} />);

    expect(screen.getByText(LONG_TEXT)).toHaveClass("min-w-0", "truncate");
  });

  it("clamps to two lines instead of one when asked", () => {
    renderWithProviders(<TruncatedText lines={2} text={LONG_TEXT} />);

    const label = screen.getByText(LONG_TEXT);

    expect(label).toHaveClass("min-w-0", "line-clamp-2");
    expect(label).not.toHaveClass("truncate");
  });

  it("offers no tooltip while the text fits", () => {
    stubBoxMetrics({ clientHeight: 16, clientWidth: 200, scrollHeight: 16, scrollWidth: 200 });
    renderWithProviders(<TruncatedText text={LONG_TEXT} />);

    expect(screen.getByText(LONG_TEXT)).not.toHaveAttribute("data-slot", "tooltip-trigger");
  });

  it("offers no tooltip when tall glyphs overhang a fitting two line clamp by a pixel", () => {
    stubBoxMetrics({ clientHeight: 35, clientWidth: 120, scrollHeight: 36, scrollWidth: 120 });
    renderWithProviders(<TruncatedText lines={2} text={LONG_TEXT} />);

    expect(screen.getByText(LONG_TEXT)).not.toHaveAttribute("data-slot", "tooltip-trigger");
  });

  it("reveals the full text on hover once the line is cut short", async () => {
    stubBoxMetrics({ clientHeight: 16, clientWidth: 120, scrollHeight: 16, scrollWidth: 400 });
    renderWithProviders(<TruncatedText text={LONG_TEXT} />);

    await userEvent.hover(screen.getByText(LONG_TEXT));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_TEXT);
  });

  it("reveals the full text on hover once the clamp hides a line", async () => {
    stubBoxMetrics({ clientHeight: 35, clientWidth: 120, scrollHeight: 70, scrollWidth: 120 });
    renderWithProviders(<TruncatedText lines={2} text={LONG_TEXT} />);

    await userEvent.hover(screen.getByText(LONG_TEXT));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_TEXT);
  });
});

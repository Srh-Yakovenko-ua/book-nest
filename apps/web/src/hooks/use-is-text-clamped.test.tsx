import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen } from "@/test-utils";

import { useIsTextClamped } from "./use-is-text-clamped";

const WIDTH_METRICS = ["clientWidth", "scrollWidth"] as const;

let restoreMetrics: () => void = () => undefined;

function measured(): HTMLElement {
  return screen.getByRole("status");
}

function Probe({ text }: { text: string }) {
  const { isClamped, ref } = useIsTextClamped<HTMLParagraphElement>(text);

  return (
    <>
      <p ref={ref}>{text}</p>
      <output>{String(isClamped)}</output>
    </>
  );
}

function stub(scrollHeight: number, clientHeight: number) {
  restoreMetrics();
  restoreMetrics = stubTextMetrics({ clientHeight, scrollHeight });
}

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("useIsTextClamped", () => {
  it("reports text that overflows its box as clamped", () => {
    stub(500, 100);

    renderWithProviders(<Probe text="Страх — убивця розуму." />);

    expect(measured()).toHaveTextContent("true");
  });

  it("reports text that fits its box as whole", () => {
    stub(100, 100);

    renderWithProviders(<Probe text="Страх — убивця розуму." />);

    expect(measured()).toHaveTextContent("false");
  });

  it("reports single-line text cut off at its width as clamped", () => {
    stub(100, 100);
    const widthDescriptors = WIDTH_METRICS.map(
      (name) => [name, Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)] as const,
    );
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 200,
    });

    try {
      renderWithProviders(<Probe text="Дуже довгий опис в один рядок" />);

      expect(measured()).toHaveTextContent("true");
    } finally {
      for (const [name, descriptor] of widthDescriptors) {
        if (descriptor === undefined) Reflect.deleteProperty(HTMLElement.prototype, name);
        else Object.defineProperty(HTMLElement.prototype, name, descriptor);
      }
    }
  });

  it("keeps a one-pixel rounding difference from counting as clamped", () => {
    stub(101, 100);

    renderWithProviders(<Probe text="Страх — убивця розуму." />);

    expect(measured()).toHaveTextContent("false");
  });

  it("re-measures when the text changes", () => {
    stub(100, 100);
    const { rerender } = renderWithProviders(<Probe text="Коротка цитата" />);
    expect(measured()).toHaveTextContent("false");

    stub(500, 100);
    rerender(<Probe text="Значно довша цитата, що вже не вміщається" />);

    expect(measured()).toHaveTextContent("true");
  });
});

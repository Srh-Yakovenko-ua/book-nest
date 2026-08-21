import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAnimatedHeight } from "./use-animated-height";

const CONTENT_HEIGHT = 400;

function container(): HTMLElement {
  return screen.getByTestId("container");
}

function Harness({ clampTo, expanded }: { clampTo?: number; expanded: boolean }) {
  const { containerRef, contentRef, isClamped } = useAnimatedHeight<HTMLParagraphElement>({
    collapsedHeight: clampTo === undefined ? undefined : () => clampTo,
    contentKey: String(expanded),
    expanded,
  });
  return (
    <div data-testid="container" ref={containerRef}>
      <p data-testid="content" ref={contentRef}>
        text
      </p>
      <span data-testid="clamped">{String(isClamped)}</span>
    </div>
  );
}

function stubScrollHeight(height: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => height,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useAnimatedHeight", () => {
  it("clamps the collapsed container and reports that the content overflows", () => {
    stubScrollHeight(CONTENT_HEIGHT);
    render(<Harness clampTo={150} expanded={false} />);

    expect(container().style.height).toBe("150px");
    expect(screen.getByTestId("clamped")).toHaveTextContent("true");
  });

  it("never stretches the container past content shorter than the clamp", () => {
    stubScrollHeight(80);
    render(<Harness clampTo={150} expanded={false} />);

    expect(container().style.height).toBe("80px");
    expect(screen.getByTestId("clamped")).toHaveTextContent("false");
  });

  it("leaves the height alone when no clamp is given", () => {
    stubScrollHeight(CONTENT_HEIGHT);
    render(<Harness expanded={false} />);

    expect(container().style.height).toBe("auto");
  });

  it("animates back to the clamp when collapsing", () => {
    stubScrollHeight(CONTENT_HEIGHT);
    const { rerender } = render(<Harness clampTo={150} expanded />);

    rerender(<Harness clampTo={150} expanded={false} />);
    expect(container().style.height).toBe("150px");
  });

  it("holds the animated height only until the transition is over", () => {
    vi.useFakeTimers();
    stubScrollHeight(CONTENT_HEIGHT);
    const { rerender } = render(<Harness clampTo={150} expanded={false} />);

    rerender(<Harness clampTo={150} expanded />);
    expect(container().style.height).toBe(`${CONTENT_HEIGHT}px`);

    vi.advanceTimersByTime(1000);
    expect(container().style.height).toBe("auto");
  });
});

import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeReadingPosition } from "../model/timeline.fixtures";
import { ReadingPositionControls } from "./reading-position-controls";

function renderControls(props: Partial<Parameters<typeof ReadingPositionControls>[0]> = {}) {
  return renderWithProviders(
    <ReadingPositionControls
      guardEnabled={false}
      onGuardChange={vi.fn()}
      onRecapChange={vi.fn()}
      readingPosition={makeReadingPosition({ currentPage: 120, positionKnown: true })}
      recap={false}
      {...props}
    />,
  );
}

describe("ReadingPositionControls", () => {
  it("offers the recap and guard controls when the position is known", () => {
    renderControls();

    expect(screen.getByRole("button", { name: "Що вже сталося" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("toggles the recap filter on activation", async () => {
    const onRecapChange = vi.fn();
    renderControls({ onRecapChange });

    await userEvent.click(screen.getByRole("button", { name: "Що вже сталося" }));

    expect(onRecapChange).toHaveBeenCalledWith(true);
  });

  it("reflects the active recap state through aria-pressed", () => {
    renderControls({ recap: true });

    expect(screen.getByRole("button", { name: "Що вже сталося" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("enables the spoiler guard from the switch", async () => {
    const onGuardChange = vi.fn();
    renderControls({ onGuardChange });

    await userEvent.click(screen.getByRole("switch"));

    expect(onGuardChange).toHaveBeenCalledWith(true);
  });

  it("renders nothing until the reading position is known", () => {
    const { container } = renderControls({
      readingPosition: makeReadingPosition({ positionKnown: false }),
    });

    expect(container).toBeEmptyDOMElement();
  });
});

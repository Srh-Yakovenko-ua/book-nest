import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { Spinner } from "./spinner";

const LABEL = "Завантаження";

function decorativeIcon() {
  return document.querySelector("svg");
}

function statusIcon() {
  return screen.getByRole("status").querySelector("svg");
}

describe("Spinner", () => {
  describe("without a label", () => {
    it("renders no status region", () => {
      renderWithProviders(<Spinner />);

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("hides the icon from assistive tech", () => {
      renderWithProviders(<Spinner />);

      expect(decorativeIcon()).toHaveAttribute("aria-hidden", "true");
    });

    it("spins only when the user allows motion", () => {
      renderWithProviders(<Spinner />);

      expect(decorativeIcon()).toHaveClass("animate-spin", "motion-reduce:animate-none");
    });

    it("draws the medium size by default", () => {
      renderWithProviders(<Spinner />);

      expect(decorativeIcon()).toHaveClass("size-4");
    });

    it.each([
      ["sm", "size-3.5"],
      ["md", "size-4"],
      ["lg", "size-6"],
    ] as const)("draws the %s size with %s", (size, sizeClass) => {
      renderWithProviders(<Spinner size={size} />);

      expect(decorativeIcon()).toHaveClass(sizeClass);
    });

    it("applies the className to the icon", () => {
      renderWithProviders(<Spinner className="text-primary" />);

      expect(decorativeIcon()).toHaveClass("text-primary");
    });
  });

  describe("with a label", () => {
    it("announces the label through a single status region", () => {
      renderWithProviders(<Spinner label={LABEL} />);

      expect(screen.getAllByRole("status")).toHaveLength(1);
      expect(screen.getByRole("status")).toHaveTextContent(new RegExp(`^${LABEL}$`));
    });

    it("hides the icon inside the status from assistive tech", () => {
      renderWithProviders(<Spinner label={LABEL} />);

      expect(statusIcon()).toHaveAttribute("aria-hidden", "true");
    });

    it("spins only when the user allows motion", () => {
      renderWithProviders(<Spinner label={LABEL} />);

      expect(statusIcon()).toHaveClass("animate-spin", "motion-reduce:animate-none");
    });

    it("sizes the icon inside the status", () => {
      renderWithProviders(<Spinner label={LABEL} size="lg" />);

      expect(statusIcon()).toHaveClass("size-6");
    });

    it("applies the className to the status wrapper instead of the icon", () => {
      renderWithProviders(<Spinner className="text-primary" label={LABEL} />);

      expect(screen.getByRole("status")).toHaveClass("text-primary");
      expect(statusIcon()).not.toHaveClass("text-primary");
    });
  });
});

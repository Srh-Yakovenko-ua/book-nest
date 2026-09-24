import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { TagNameCapsule } from "./tag-name-capsule";

const LONG_NAME = "декілька хронологічних ліній і паралельних сюжетів";

let restoreMetrics: () => void = () => undefined;

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

describe("TagNameCapsule", () => {
  it("paints the tag name with its color tokens and no border", () => {
    renderWithProviders(<TagNameCapsule color="lavender" name="вампіри" variant="card" />);

    const heading = screen.getByRole("heading", { name: "вампіри" });
    expect(heading.style.backgroundColor).toBe("var(--tag-lavender)");
    expect(heading.style.color).toBe("var(--tag-lavender-foreground)");
    expect(heading).toHaveClass("rounded-full");
    expect(heading).not.toHaveClass("border");
  });

  it("prefixes the name with a hash", () => {
    renderWithProviders(<TagNameCapsule color="sage" name="вампіри" variant="card" />);

    expect(screen.getByRole("heading").querySelector("use")).toHaveAttribute(
      "href",
      "/icons/ui-icons.svg#i-hash",
    );
  });

  it("keeps a long name on one line with an ellipsis", () => {
    renderWithProviders(<TagNameCapsule color="sky" name={LONG_NAME} variant="card" />);

    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("shows the whole name on one line in a list row from md up", () => {
    renderWithProviders(<TagNameCapsule color="sky" name={LONG_NAME} variant="row" />);

    expect(screen.getByText(LONG_NAME)).toHaveClass("md:overflow-visible", "md:text-clip");
    expect(screen.getByRole("heading")).toHaveClass("md:max-w-none", "md:shrink-0");
  });

  it("shows the full name in a tooltip when it is cut off", async () => {
    restoreMetrics = stubTextMetrics({ clientWidth: 120, scrollWidth: 300 });
    const user = userEvent.setup();
    renderWithProviders(<TagNameCapsule color="sky" name={LONG_NAME} variant="card" />);

    await user.hover(screen.getByRole("heading"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
  });

  it("shows no tooltip when the name fits", async () => {
    restoreMetrics = stubTextMetrics({ clientWidth: 300, scrollWidth: 300 });
    const user = userEvent.setup();
    renderWithProviders(<TagNameCapsule color="sky" name="відьми" variant="card" />);

    await user.hover(screen.getByRole("heading"));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("names the color for screen readers", () => {
    renderWithProviders(<TagNameCapsule color="rose" name="вампіри" variant="card" />);

    expect(screen.getByText(/Колір/)).toHaveClass("sr-only");
  });
});

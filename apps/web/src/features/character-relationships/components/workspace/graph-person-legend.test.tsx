import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { GraphPersonLegend } from "./graph-person-legend";

const legend = messages.relationships.workspace.legend;

const categories = messages.relationships.categories;

const LEGEND_LABELS = [
  categories.family,
  categories.romantic,
  categories.social,
  categories.conflict,
  categories.mentorship,
  categories.hierarchy,
  categories.supernatural,
  categories.custom,
  legend.mixed,
  legend.masked,
];

const FILTERED_OUT_BY_FAMILY = [false, true, true, true, true, true, true, true, false, false];

function isFilteredOut(item: HTMLElement) {
  return within(item).queryByText(legend.filteredOut) !== null;
}

function legendItems() {
  return within(screen.getByRole("list", { name: legend.title })).getAllByRole("listitem");
}

describe("GraphPersonLegend", () => {
  it("starts collapsed behind the show-all toggle", () => {
    renderWithProviders(<GraphPersonLegend activeCategories={[]} />);

    expect(screen.getByRole("button", { name: legend.expand })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps the collapsed preview hidden from assistive technology", () => {
    renderWithProviders(<GraphPersonLegend activeCategories={[]} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("turns the toggle into a collapse control once expanded", async () => {
    renderWithProviders(<GraphPersonLegend activeCategories={[]} />);

    await userEvent.click(screen.getByRole("button", { name: legend.expand }));

    expect(screen.getByRole("button", { name: legend.collapse })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("lists every relationship category plus mixed and hidden pairs once expanded", async () => {
    renderWithProviders(<GraphPersonLegend activeCategories={[]} />);

    await userEvent.click(screen.getByRole("button", { name: legend.expand }));

    expect(legendItems().map((item) => item.textContent)).toEqual(LEGEND_LABELS);
  });

  it("marks categories outside the active filter as filtered out", async () => {
    renderWithProviders(<GraphPersonLegend activeCategories={["family"]} />);

    await userEvent.click(screen.getByRole("button", { name: legend.expand }));

    expect(legendItems().map(isFilteredOut)).toEqual(FILTERED_OUT_BY_FAMILY);
  });

  it("treats legend entries as a key, not as controls", async () => {
    renderWithProviders(<GraphPersonLegend activeCategories={["family"]} />);

    await userEvent.click(screen.getByRole("button", { name: legend.expand }));
    const list = screen.getByRole("list", { name: legend.title });
    await userEvent.click(within(list).getByText(categories.romantic));

    expect(within(list).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: legend.collapse })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(legendItems().map(isFilteredOut)).toEqual(FILTERED_OUT_BY_FAMILY);
  });
});

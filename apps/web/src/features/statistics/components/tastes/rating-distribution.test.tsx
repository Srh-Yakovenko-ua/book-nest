import type { Nullable, ReadingStatisticsRatingBucket } from "@app/shared";

import { describe, expect, it } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { RatingDistribution } from "./rating-distribution";

const ratingsText = messages.statistics.ratings;

const SCALE_STEPS = 20;

const GIVEN_SCORES: ReadonlyMap<number, number> = new Map([
  [8, 1],
  [9, 2],
  [10, 1],
]);

const NO_SCORES: ReadonlyMap<number, number> = new Map();

const GIVEN_ROW_NAMES = [
  "Оцінка 10,0: 1 читання, 25% оцінених",
  "Оцінка 9,0: 2 читання, 50% оцінених",
  "Оцінка 8,0: 1 читання, 25% оцінених",
];

const RATING_BAR = /^Оцінка /;

const SCALE_HINT_LABEL = ratingsText.distributionScaleHintLabel;

const SCALE_HINT = ratingsText.distributionScaleHint;

function barNames(): Nullable<string>[] {
  return ratingBars().map((track) => track.getAttribute("aria-label"));
}

function fillWidths(): string[] {
  return ratingBars().map((track) => {
    const fill = track.querySelector<HTMLElement>("[style*='width']");
    if (fill === null) throw new Error("every rating bar draws a fill");
    return fill.style.width;
  });
}

function fullScale(
  counts: ReadonlyMap<number, number>,
  missingCount = 0,
): ReadingStatisticsRatingBucket[] {
  return Array.from({ length: SCALE_STEPS }, (_, step) => {
    const rating = 10 - step * 0.5;
    return { completedReadCount: counts.get(rating) ?? missingCount, rating };
  });
}

function ratingBars(): HTMLElement[] {
  return screen.queryAllByRole("img", { name: RATING_BAR });
}

describe("RatingDistribution", () => {
  it("titles the distribution", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    expect(screen.getByText(ratingsText.distributionTitle)).toBeInTheDocument();
  });

  it("names the list of scores after its heading", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    expect(screen.getByRole("list", { name: ratingsText.distributionTitle })).toBeInTheDocument();
  });

  it("shows each given score's count with its share of the rated reads", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent(/1\s*·\s*25%/);
    expect(rows[1]).toHaveTextContent(/2\s*·\s*50%/);
    expect(rows[2]).toHaveTextContent(/1\s*·\s*25%/);
  });

  it("explains how to read the scale from an info button next to the heading", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    await user.hover(screen.getByRole("button", { name: SCALE_HINT_LABEL }));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(SCALE_HINT);
  });

  it("lists only the scores that were given, highest first", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES).reverse()} />);

    expect(barNames()).toEqual(GIVEN_ROW_NAMES);
  });

  it("draws a single given score as one full bar and still offers the full scale", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(new Map([[7.5, 1]]))} />);

    expect(barNames()).toEqual(["Оцінка 7,5: 1 читання, 100% оцінених"]);
    expect(screen.getByRole("listitem")).toHaveTextContent(/1\s*·\s*100%/);
    expect(fillWidths()).toEqual(["100%"]);
    expect(
      screen.getByRole("button", { name: ratingsText.distributionShowAll }),
    ).toBeInTheDocument();
  });

  it("sizes every bar by its share of the rated reads", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    expect(fillWidths()).toEqual(["25%", "50%", "25%"]);
  });

  it("points a collapsed toggle at the list it expands", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    const toggle = screen.getByRole("button", { name: ratingsText.distributionShowAll });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls");
    expect(screen.getByRole("list", { name: ratingsText.distributionTitle })).toHaveAttribute(
      "id",
      toggle.getAttribute("aria-controls"),
    );
  });

  it("expands to the whole twenty-step scale including the unused scores", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    await user.click(screen.getByRole("button", { name: ratingsText.distributionShowAll }));

    expect(ratingBars()).toHaveLength(SCALE_STEPS);
    expect(screen.getByRole("img", { name: "Оцінка 0,5: 0 читань" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ratingsText.distributionShowPresent }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("shows a bare zero without a share on an unused score of the full scale", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    await user.click(screen.getByRole("button", { name: ratingsText.distributionShowAll }));

    const lowestRow = screen.getAllByRole("listitem").at(-1);
    if (lowestRow === undefined) throw new Error("the full scale renders no rows");
    expect(
      within(lowestRow).getByRole("img", { name: "Оцінка 0,5: 0 читань" }),
    ).toBeInTheDocument();
    expect(lowestRow).toHaveTextContent(/0$/);
    expect(lowestRow).not.toHaveTextContent(/·|%/);
  });

  it("collapses the full scale back to the given scores", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    await user.click(screen.getByRole("button", { name: ratingsText.distributionShowAll }));
    await user.click(screen.getByRole("button", { name: ratingsText.distributionShowPresent }));

    expect(barNames()).toEqual(GIVEN_ROW_NAMES);
    expect(screen.getByRole("button", { name: ratingsText.distributionShowAll })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("toggles the scale from the keyboard", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(GIVEN_SCORES)} />);

    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: ratingsText.distributionShowAll })).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(ratingBars()).toHaveLength(SCALE_STEPS);
    expect(screen.getByRole("button", { name: ratingsText.distributionShowPresent })).toHaveFocus();

    await user.keyboard(" ");
    expect(ratingBars()).toHaveLength(GIVEN_ROW_NAMES.length);
  });

  it("shows every score without a toggle when none of them is empty", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(NO_SCORES, 1)} />);

    expect(ratingBars()).toHaveLength(SCALE_STEPS);
    expect(
      screen.queryByRole("button", { name: ratingsText.distributionShowAll }),
    ).not.toBeInTheDocument();
  });

  it("gives each of twenty equally used scores a twentieth of the bar", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(NO_SCORES, 1)} />);

    expect(fillWidths()).toEqual(Array.from({ length: SCALE_STEPS }, () => "5%"));
  });

  it("says there is nothing to plot when no score was given", () => {
    renderWithProviders(<RatingDistribution distribution={fullScale(NO_SCORES)} />);

    expect(screen.getByText(ratingsText.distributionEmpty)).toBeInTheDocument();
    expect(ratingBars()).toHaveLength(0);
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("expands an all-zero scale into empty bars rather than broken widths", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RatingDistribution distribution={fullScale(NO_SCORES)} />);

    await user.click(screen.getByRole("button", { name: ratingsText.distributionShowAll }));

    expect(fillWidths()).toEqual(Array.from({ length: SCALE_STEPS }, () => "0%"));
  });

  it("says there is nothing to plot for an empty distribution and offers no toggle", () => {
    renderWithProviders(<RatingDistribution distribution={[]} />);

    expect(screen.getByText(ratingsText.distributionEmpty)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: ratingsText.distributionShowAll }),
    ).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);
  });
});

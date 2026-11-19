import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    "aria-label": ariaLabel,
    children,
    href,
  }: {
    "aria-label"?: string;
    children: ReactNode;
    href: string;
  }) => (
    <a aria-label={ariaLabel} href={href}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, within } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { PublishersSection } from "./publishers-section";

const { publishers } = overviewFixture();

const publishersText = messages.statistics.publishers;

function publisherItem(name: string, completedReadCount: number) {
  const [item] = publishers.items;
  if (item === undefined) throw new Error("fixture must expose one publisher");
  return { ...item, completedReadCount, name, publisherId: name };
}

describe("PublishersSection", () => {
  it.each([
    { text: "1 видавництво", totalPublishers: 1 },
    { text: "3 видавництва", totalPublishers: 3 },
    { text: "5 видавництв", totalPublishers: 5 },
  ])("counts $totalPublishers publisher(s) in the header as $text", ({ text, totalPublishers }) => {
    renderWithProviders(<PublishersSection publishers={{ ...publishers, totalPublishers }} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("shows no publisher-count or top-3 tiles", () => {
    renderWithProviders(<PublishersSection publishers={publishers} />);

    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByText("Видавництв")).not.toBeInTheDocument();
    expect(screen.queryByText("Частка топ-3")).not.toBeInTheDocument();
  });

  it("states the top three's share of reads with a known publisher when there are more than three", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{ ...publishers, topThreeConcentration: 0.8, totalPublishers: 4 }}
      />,
    );

    expect(
      screen.getByText(publishersText.topThreeShare.replace("{percent}", "80")),
    ).toBeInTheDocument();
  });

  it.each([
    { topThreeConcentration: 1, totalPublishers: 3 },
    { topThreeConcentration: null, totalPublishers: 5 },
  ])(
    "states no top-3 share for $totalPublishers publishers at concentration $topThreeConcentration",
    (overrides) => {
      const [topThreeLabel = ""] = publishersText.topThreeShare.split(":");
      renderWithProviders(<PublishersSection publishers={{ ...publishers, ...overrides }} />);

      expect(screen.queryByText(topThreeLabel, { exact: false })).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    },
  );

  it("fills each bar to the publisher's share of reads with a known publisher", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{
          ...publishers,
          coverage: { eligibleCount: 10, knownCount: 8, percent: 0.8 },
          items: [publisherItem("Old Lion Publishing", 4), publisherItem("Laurus", 2)],
        }}
      />,
    );

    const widths = within(screen.getByRole("list"))
      .getAllByRole("listitem")
      .map((row) =>
        Number.parseFloat(row.querySelector<HTMLElement>("[style*='width']")?.style.width ?? ""),
      );
    expect(widths).toEqual([50, 25]);
  });

  it("states each publisher's share of reads with a known publisher after its rating", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{
          ...publishers,
          coverage: { eligibleCount: 10, knownCount: 8, percent: 0.8 },
          items: [
            publisherItem("Old Lion Publishing", 4),
            { ...publisherItem("Laurus", 2), averageRating: null },
          ],
        }}
      />,
    );

    const [rated, unrated] = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rated).toHaveTextContent(/8,5.*50% відомих/);
    expect(unrated).toHaveTextContent("25% відомих");
    expect(unrated).not.toHaveTextContent("8,5");
  });

  it("shows partial coverage once, as the description, with no footer note", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{
          ...publishers,
          availability: "partial",
          coverage: { eligibleCount: 6, knownCount: 4, percent: 0.667 },
        }}
      />,
    );

    expect(screen.getAllByText("Видавництво відоме для 4 із 6 читань")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("4 із 6 читань мають збережене видавництво")).not.toBeInTheDocument();
  });

  it("shows neither a generic description nor a coverage text when every read has a publisher", () => {
    renderWithProviders(<PublishersSection publishers={publishers} />);

    expect(screen.queryByText("Видавництва завершених читань періоду.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Видавництво відоме для/)).not.toBeInTheDocument();
  });

  it("shows the publisher's average rating beside its reads", () => {
    renderWithProviders(<PublishersSection publishers={publishers} />);

    expect(within(screen.getByRole("list")).getByRole("listitem")).toHaveTextContent("8,5");
  });

  it("links a publisher to its page", () => {
    renderWithProviders(<PublishersSection publishers={publishers} />);

    expect(
      screen.getByRole("link", { name: messages.statistics.contextActions.open_publisher }),
    ).toHaveAttribute("href", `/publishers/${statisticsIds.publisherId}`);
  });

  it("shows all five publishers with no show-more control", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{
          ...publishers,
          coverage: { eligibleCount: 15, knownCount: 15, percent: 1 },
          items: [
            publisherItem("Old Lion Publishing", 5),
            publisherItem("Laurus", 4),
            publisherItem("Folio", 3),
            publisherItem("Nash Format", 2),
            publisherItem("Vivat", 1),
          ],
        }}
      />,
    );

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row).not.toHaveClass("hidden");
    }
    expect(screen.queryByRole("button", { name: /Показати ще/ })).not.toBeInTheDocument();
  });

  it("shows the empty state without a count when the period has no publishers", () => {
    renderWithProviders(
      <PublishersSection
        publishers={{ ...publishers, items: [], topThreeConcentration: null, totalPublishers: 0 }}
      />,
    );

    expect(screen.getByText(publishersText.empty)).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ видавницт/)).not.toBeInTheDocument();
    expect(screen.queryByText("Видавництва завершених читань періоду.")).not.toBeInTheDocument();
  });
});

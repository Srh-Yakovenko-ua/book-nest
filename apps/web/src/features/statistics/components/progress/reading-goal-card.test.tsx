import type { ReadingGoalMetrics, ReadingStatisticsGoalSection } from "@app/shared";
import type { ReactNode } from "react";

import { ReadingGoalPaceSchema } from "@app/shared";
import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { stubTextMetrics } from "@/features/quotes/model/quotes.fixtures";
import { formatDateLong } from "@/lib/format";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { overviewFixture, statisticsIds } from "../../model/statistics.fixtures";
import { ReadingGoalCard } from "./reading-goal-card";

type PrimaryGoal = NonNullable<ReadingStatisticsGoalSection["primaryGoal"]>;

const goalText = messages.statistics.goal;

const translateGoal = createTranslator({ locale: "uk", messages, namespace: "statistics.goal" });

const VARIANTS = ["compact", "full"] as const;

const LONG_NAME =
  "Read every volume of the collected chronicles of Earthsea, its archipelago and every island beyond before the winter holidays";

const UNRELIABLE_FORECASTS: Partial<ReadingGoalMetrics>[] = [
  { projectedCompletionDate: "2026-12-20", projectionConfidence: "low" },
  { projectedCompletionDate: "2026-12-20", projectionConfidence: "none" },
  { projectedCompletionDate: null, projectionConfidence: "high" },
];

let restoreMetrics: () => void = () => undefined;

afterEach(() => {
  restoreMetrics();
  restoreMetrics = () => undefined;
});

function goalWith({
  activeGoalsCount = 1,
  metrics = {},
  primary = {},
}: {
  activeGoalsCount?: number;
  metrics?: Partial<ReadingGoalMetrics>;
  primary?: Partial<PrimaryGoal>;
} = {}): ReadingStatisticsGoalSection {
  const { primaryGoal } = overviewFixture().goal;
  if (primaryGoal === null) throw new Error("the overview fixture has no primary goal");

  return {
    activeGoalsCount,
    primaryGoal: { ...primaryGoal, ...primary, metrics: { ...primaryGoal.metrics, ...metrics } },
  };
}

describe("ReadingGoalCard", () => {
  it("shows a long goal name in full and lets it wrap in the full card", () => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ primary: { name: LONG_NAME } })} variant="full" />,
    );

    const name = screen.getByText(LONG_NAME);
    expect(name).toHaveClass("break-words");
    expect(name).not.toHaveClass("truncate");
  });

  it("keeps a long goal name on one truncated line in the compact card", () => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ primary: { name: LONG_NAME } })} variant="compact" />,
    );

    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("reveals the full goal name on hover once the compact name is cut short", async () => {
    restoreMetrics = stubTextMetrics({ clientWidth: 120, scrollWidth: 400 });
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ primary: { name: LONG_NAME } })} variant="compact" />,
    );

    await user.hover(screen.getByText(LONG_NAME));

    expect(await screen.findByRole("tooltip")).toHaveTextContent(LONG_NAME);
  });

  it("labels the pace instead of repeating the goal status", () => {
    renderWithProviders(<ReadingGoalCard goal={goalWith()} variant="full" />);

    expect(screen.getByText(goalText.pace)).toBeInTheDocument();
    expect(screen.queryByText(messages.goals.status.active)).not.toBeInTheDocument();
  });

  it.each(ReadingGoalPaceSchema.options)("names the %s pace in words", (pace) => {
    renderWithProviders(<ReadingGoalCard goal={goalWith({ metrics: { pace } })} variant="full" />);

    expect(screen.getByText(goalText.paces[pace])).toBeInTheDocument();
  });

  it("says the pace is not known yet when the goal has none", () => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ metrics: { pace: null } })} variant="full" />,
    );

    expect(screen.getByText(goalText.paceUnknown)).toBeInTheDocument();
    for (const paceText of Object.values(goalText.paces)) {
      expect(screen.queryByText(paceText)).not.toBeInTheDocument();
    }
  });

  it("leaves the pace to the full card", () => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ metrics: { pace: "on_track" } })} variant="compact" />,
    );

    expect(screen.queryByText(goalText.pace)).not.toBeInTheDocument();
    expect(screen.queryByText(goalText.paces.on_track)).not.toBeInTheDocument();
  });

  it("dates the deadline with its year in the full card", () => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ primary: { deadline: "2027-02-14" } })} variant="full" />,
    );

    expect(screen.getByText(goalText.deadlineLabel)).toBeInTheDocument();
    expect(screen.getByText(formatDateLong("2027-02-14", "uk"))).toHaveTextContent(/2027/);
  });

  it.each(["medium", "high"] as const)(
    "dates a %s-confidence forecast with its year",
    (projectionConfidence) => {
      renderWithProviders(
        <ReadingGoalCard
          goal={goalWith({
            metrics: { projectedCompletionDate: "2026-12-20", projectionConfidence },
            primary: { deadline: "2027-02-14" },
          })}
          variant="full"
        />,
      );

      expect(screen.getByText(formatDateLong("2026-12-20", "uk"))).toHaveTextContent(/2026/);
      expect(screen.queryByText(goalText.forecastUnavailable)).not.toBeInTheDocument();
    },
  );

  it.each(UNRELIABLE_FORECASTS)(
    "withholds the forecast date at $projectionConfidence confidence with date $projectedCompletionDate",
    (metrics) => {
      renderWithProviders(<ReadingGoalCard goal={goalWith({ metrics })} variant="full" />);

      expect(screen.getByText(goalText.forecastUnavailable)).toBeInTheDocument();
      expect(screen.queryByText(formatDateLong("2026-12-20", "uk"))).not.toBeInTheDocument();
    },
  );

  it.each(VARIANTS)(
    "does not round a goal with one book left up to done in the %s card",
    (variant) => {
      renderWithProviders(
        <ReadingGoalCard
          goal={goalWith({
            metrics: { completedCount: 199, progressPercent: 99.5, remainingCount: 1 },
            primary: { targetCount: 200 },
          })}
          variant={variant}
        />,
      );

      expect(screen.getByText("99%")).toBeInTheDocument();
      expect(
        screen.getByRole("progressbar", { name: translateGoal("progressLabel", { percent: 99 }) }),
      ).toBeInTheDocument();
      expect(screen.queryByText("100%")).not.toBeInTheDocument();
    },
  );

  it.each(VARIANTS)("shows a goal with no books left as done in the %s card", (variant) => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({
          metrics: { completedCount: 12, progressPercent: 100, remainingCount: 0 },
          primary: { targetCount: 12 },
        })}
        variant={variant}
      />,
    );

    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: translateGoal("progressLabel", { percent: 100 }) }),
    ).toBeInTheDocument();
  });

  it.each(VARIANTS)("offers to create a goal when there is none in the %s card", (variant) => {
    renderWithProviders(
      <ReadingGoalCard goal={{ activeGoalsCount: 0, primaryGoal: null }} variant={variant} />,
    );

    expect(screen.getByRole("link", { name: goalText.create })).toHaveAttribute("href", "/goals");
  });

  it.each(VARIANTS)("links the other active goals to the goals page in the %s card", (variant) => {
    renderWithProviders(
      <ReadingGoalCard goal={goalWith({ activeGoalsCount: 3 })} variant={variant} />,
    );

    expect(
      screen.getByRole("link", { name: translateGoal("otherGoals", { count: 2 }) }),
    ).toHaveAttribute("href", "/goals");
  });

  it.each(VARIANTS)("opens the shown goal from the %s card", (variant) => {
    renderWithProviders(<ReadingGoalCard goal={goalWith()} variant={variant} />);

    expect(screen.getByRole("link", { name: goalText.open })).toHaveAttribute(
      "href",
      `/goals/${statisticsIds.goalId}`,
    );
  });

  it("states the current-state caption once in the full card", () => {
    renderWithProviders(<ReadingGoalCard goal={goalWith()} variant="full" />);

    expect(screen.getAllByText(goalText.description)).toHaveLength(1);
  });

  it("dates the deadline under the progress bar in the compact card", () => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({ primary: { deadline: "2027-02-14" } })}
        variant="compact"
      />,
    );

    expect(screen.getByText(translateGoal("deadline", { date: "14 лют." }))).toBeInTheDocument();
    expect(screen.queryByText(goalText.deadlineLabel)).not.toBeInTheDocument();
  });

  it("shows the books ahead of a not-started goal in the compact card", () => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({ metrics: { completedCount: 0, progressPercent: 0, remainingCount: 12 } })}
        variant="compact"
      />,
    );

    expect(screen.getByText(translateGoal("notStarted", { count: 12 }))).toBeInTheDocument();
    expect(screen.queryByText(goalText.remaining)).not.toBeInTheDocument();
  });

  it("counts the books left in a compact card with the goal under way", () => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({ metrics: { completedCount: 3, progressPercent: 25, remainingCount: 9 } })}
        variant="compact"
      />,
    );

    expect(screen.getByText(goalText.remaining)).toBeInTheDocument();
    expect(screen.getByText(translateGoal("remainingValue", { count: 9 }))).toBeInTheDocument();
    expect(screen.queryByText(translateGoal("notStarted", { count: 9 }))).not.toBeInTheDocument();
  });

  it("drops the caption from a compact card whose goal is done", () => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({
          metrics: { completedCount: 12, progressPercent: 100, remainingCount: 0 },
          primary: { targetCount: 12 },
        })}
        variant="compact"
      />,
    );

    expect(screen.queryByText(goalText.remaining)).not.toBeInTheDocument();
    expect(screen.queryByText(translateGoal("notStarted", { count: 0 }))).not.toBeInTheDocument();
  });

  it("keeps the remaining count, not the not-started line, in the full card", () => {
    renderWithProviders(
      <ReadingGoalCard
        goal={goalWith({ metrics: { completedCount: 0, progressPercent: 0, remainingCount: 12 } })}
        variant="full"
      />,
    );

    expect(screen.getByText(translateGoal("remainingValue", { count: 12 }))).toBeInTheDocument();
    expect(screen.queryByText(translateGoal("notStarted", { count: 12 }))).not.toBeInTheDocument();
  });
});

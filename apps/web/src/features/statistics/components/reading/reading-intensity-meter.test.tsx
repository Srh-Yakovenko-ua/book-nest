import { describe, expect, it } from "vitest";

import { renderWithProviders, screen, within } from "@/test-utils";

import { ReadingIntensityMeter } from "./reading-intensity-meter";

const METER_HOST_NAME = "intensity meter host";

function meterHost(): HTMLElement {
  return screen.getByRole("region", { name: METER_HOST_NAME });
}

function meterParts(): { fill: HTMLElement; track: HTMLElement } {
  const [track, fill] = within(meterHost()).getAllByRole("generic", { hidden: true });
  if (track === undefined || fill === undefined) throw new Error("the meter has no track or fill");
  return { fill, track };
}

function renderMeter(level: number) {
  renderWithProviders(
    <section aria-label={METER_HOST_NAME}>
      <ReadingIntensityMeter level={level} />
    </section>,
  );
}

describe("ReadingIntensityMeter", () => {
  it.each([
    { fillWidth: "w-0", level: 0 },
    { fillWidth: "w-1", level: 1 },
    { fillWidth: "w-2", level: 2 },
    { fillWidth: "w-3", level: 3 },
    { fillWidth: "w-4", level: 4 },
  ])("fills $fillWidth of a w-4 track at level $level", ({ fillWidth, level }) => {
    renderMeter(level);

    const { fill, track } = meterParts();
    expect(track).toHaveClass("w-4");
    expect(track).toContainElement(fill);
    expect(fill).toHaveClass(fillWidth);
  });

  it("keeps the meter out of the accessibility tree", () => {
    renderMeter(2);

    expect(within(meterHost()).getAllByRole("generic", { hidden: true })).toHaveLength(2);
    expect(within(meterHost()).queryAllByRole("generic")).toHaveLength(0);
  });
});

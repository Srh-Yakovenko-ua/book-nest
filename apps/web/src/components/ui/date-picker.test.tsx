import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { DatePicker } from "./date-picker";

const DATES = {
  today: new Date(2024, 2, 20, 9, 0, 0),
  value: new Date(2024, 2, 5),
};

const NAMES = {
  dayAfterToday: "четвер, 21-е березня 2024 р.",
  dayBeforeToday: "вівторок, 19-е березня 2024 р.",
  defaultTrigger: "Оберіть дату народження",
  defaultTriggerWithValue: "Оберіть дату народження, 5 березня 2024",
  selectedDay: "вівторок, 5-е березня 2024 р., обрано",
  today: "Сьогодні, середа, 20-е березня 2024 р.",
  trigger: "Початок періоду",
  triggerWithValue: "Початок періоду, 5 березня 2024",
};

async function openPicker() {
  await userEvent.click(screen.getByRole("button", { name: NAMES.triggerWithValue }));
}

function renderPicker(overrides: Partial<Parameters<typeof DatePicker>[0]> = {}): {
  onChange: ReturnType<typeof vi.fn>;
} {
  const onChange = vi.fn();
  renderWithProviders(
    <DatePicker
      ariaLabel={NAMES.trigger}
      id="period-start"
      onChange={onChange}
      today={DATES.today}
      value={DATES.value}
      {...overrides}
    />,
  );
  return { onChange };
}

describe("DatePicker", () => {
  it("names the trigger after its label and the chosen date", () => {
    renderPicker();

    expect(screen.getByRole("button")).toHaveAccessibleName(NAMES.triggerWithValue);
  });

  it("names an empty trigger after its label alone", () => {
    renderPicker({ value: undefined });

    expect(screen.getByRole("button")).toHaveAccessibleName(NAMES.trigger);
  });

  it("flags the trigger as invalid", () => {
    renderPicker({ invalid: true });

    expect(screen.getByRole("button")).toHaveAttribute("aria-invalid", "true");
  });

  it("describes the trigger with the element it points to", () => {
    renderWithProviders(
      <>
        <DatePicker
          ariaLabel={NAMES.trigger}
          describedBy="period-start-error"
          id="period-start"
          onChange={vi.fn()}
        />
        <p id="period-start-error">Вкажіть дату початку</p>
      </>,
    );

    expect(screen.getByRole("button")).toHaveAccessibleDescription("Вкажіть дату початку");
  });

  it("keeps the date when the selected day is picked again in a required field", async () => {
    const { onChange } = renderPicker({ required: true });

    await openPicker();
    await userEvent.click(screen.getByRole("button", { name: NAMES.selectedDay }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(DATES.value);
  });

  it("clears the date when the selected day is picked again in an optional field", async () => {
    const { onChange } = renderPicker();

    await openPicker();
    await userEvent.click(screen.getByRole("button", { name: NAMES.selectedDay }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("closes the days after the given today", async () => {
    renderPicker();

    await openPicker();

    expect(screen.getByRole("button", { name: NAMES.today })).toBeEnabled();
    expect(screen.getByRole("button", { name: NAMES.dayAfterToday })).toBeDisabled();
  });

  it("closes the days before the given today when the past is off limits", async () => {
    renderPicker({ disablePast: true });

    await openPicker();

    expect(screen.getByRole("button", { name: NAMES.dayBeforeToday })).toBeDisabled();
    expect(screen.getByRole("button", { name: NAMES.today })).toBeEnabled();
  });

  it("names the open calendar after the label", async () => {
    renderPicker();

    await openPicker();

    expect(screen.getByRole("dialog")).toHaveAccessibleName(NAMES.trigger);
  });

  it("names the open calendar after the default label when none is given", async () => {
    renderPicker({ ariaLabel: undefined });

    await userEvent.click(screen.getByRole("button", { name: NAMES.defaultTriggerWithValue }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName(NAMES.defaultTrigger);
  });

  it("announces the selected day in Ukrainian", async () => {
    renderPicker();

    await openPicker();

    const selectedCell = screen.getByRole("gridcell", { selected: true });
    expect(within(selectedCell).getByRole("button")).toHaveAccessibleName(NAMES.selectedDay);
  });

  it("announces the given today in Ukrainian", async () => {
    renderPicker();

    await openPicker();

    expect(screen.getByRole("button", { name: NAMES.today })).toBeInTheDocument();
  });

  describe("without a given today", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(DATES.today);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("closes the days after the current date", async () => {
      renderPicker({ today: undefined });

      await openPicker();

      expect(screen.getByRole("button", { name: NAMES.today })).toBeEnabled();
      expect(screen.getByRole("button", { name: NAMES.dayAfterToday })).toBeDisabled();
    });
  });
});

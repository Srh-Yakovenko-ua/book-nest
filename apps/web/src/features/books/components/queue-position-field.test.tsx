import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { QueuePositionField } from "./queue-position-field";

const copy = messages.readingQueue.position;

function renderField(overrides: Partial<Parameters<typeof QueuePositionField>[0]> = {}) {
  return renderWithProviders(
    <QueuePositionField
      onPlacementChange={vi.fn()}
      onPositionChange={vi.fn()}
      placement="specific"
      position="2"
      queueLength={3}
      {...overrides}
    />,
  );
}

describe("QueuePositionField", () => {
  it("hides the numeric position input for a non-specific placement", () => {
    renderField({ placement: "end" });

    expect(screen.queryByLabelText(copy.positionLabel)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: copy.specific })).toBeInTheDocument();
  });

  it("shows the numeric position input for a specific placement", () => {
    renderField({ placement: "specific", position: "2" });

    expect(screen.getByLabelText(copy.positionLabel)).toHaveValue("2");
  });

  it("marks the position input as required when a specific position is expected", () => {
    renderField({ placement: "specific" });

    expect(screen.getByLabelText(copy.positionLabel)).toBeRequired();
  });

  it("shows the empty-queue helper instead of the input when the queue is empty", () => {
    renderField({ placement: "specific", queueLength: 0 });

    expect(screen.getByText(copy.emptyHelper)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.positionLabel)).not.toBeInTheDocument();
  });

  it("marks the input invalid and describes it with an alert when an error is present", () => {
    renderField({ error: "Boom", placement: "specific" });

    const input = screen.getByLabelText(copy.positionLabel);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Boom");
    expect(input).toHaveAccessibleDescription(new RegExp("Boom"));
  });

  it("leaves the input valid with no alert when there is no error", () => {
    renderField({ error: undefined, placement: "specific" });

    expect(screen.getByLabelText(copy.positionLabel)).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports the chosen placement when a radio is selected", async () => {
    const onPlacementChange = vi.fn();
    renderField({ onPlacementChange, placement: "end" });

    await userEvent.click(screen.getByRole("radio", { name: copy.specific }));

    expect(onPlacementChange).toHaveBeenCalledWith("specific");
  });

  it("reports each typed character through onPositionChange", async () => {
    const onPositionChange = vi.fn();
    renderField({ onPositionChange, placement: "specific", position: "" });

    await userEvent.type(screen.getByLabelText(copy.positionLabel), "7");

    expect(onPositionChange).toHaveBeenLastCalledWith("7");
  });
});

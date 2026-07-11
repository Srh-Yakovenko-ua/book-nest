import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import type { QueuePickerItem } from "../model/queue-placement";

import { QueuePositionField } from "./queue-position-field";

const copy = messages.readingQueue.position;

const CANDIDATES: QueuePickerItem[] = [
  { id: "book-1", position: 1, title: "Перша книга" },
  { id: "book-2", position: 2, title: "Друга книга" },
];

function renderField(overrides: Partial<Parameters<typeof QueuePositionField>[0]> = {}) {
  return renderWithProviders(
    <QueuePositionField
      candidates={CANDIDATES}
      maxPosition={4}
      onPlacementChange={vi.fn()}
      onPositionChange={vi.fn()}
      onRelativeBookChange={vi.fn()}
      onRelativeSideChange={vi.fn()}
      outcome={null}
      placement="specific"
      position="2"
      queueLength={3}
      relativeBookId={null}
      relativeSide="after"
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

  it("offers the relative placement option when candidates exist", () => {
    renderField({ placement: "end" });

    expect(screen.getByRole("radio", { name: copy.relative })).toBeInTheDocument();
  });

  it("hides the relative option when there are no candidates", () => {
    renderField({ candidates: [], placement: "end" });

    expect(screen.queryByRole("radio", { name: copy.relative })).not.toBeInTheDocument();
  });

  it("shows the numeric position input for a specific placement", () => {
    renderField({ placement: "specific", position: "2" });

    expect(screen.getByLabelText(copy.positionLabel)).toHaveValue("2");
  });

  it("uses a range placeholder on the numeric input", () => {
    renderField({ maxPosition: 4, placement: "specific", position: "" });

    expect(screen.getByLabelText(copy.positionLabel)).toHaveAttribute("placeholder", "від 1 до 4");
  });

  it("marks the position input as required when a specific position is expected", () => {
    renderField({ placement: "specific" });

    expect(screen.getByLabelText(copy.positionLabel)).toBeRequired();
  });

  it("renders only the result preview when the queue is empty", () => {
    renderField({ outcome: { kind: "first" }, queueLength: 0 });

    expect(screen.getByText(copy.resultFirst)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.positionLabel)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: copy.specific })).not.toBeInTheDocument();
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

  it("propagates an in-range numeric value", async () => {
    const onPositionChange = vi.fn();
    renderField({ maxPosition: 4, onPositionChange, placement: "specific", position: "" });

    await userEvent.type(screen.getByLabelText(copy.positionLabel), "3");

    expect(onPositionChange).toHaveBeenLastCalledWith("3");
  });

  it("clamps a value larger than the maximum", async () => {
    const onPositionChange = vi.fn();
    renderField({ maxPosition: 4, onPositionChange, placement: "specific", position: "" });

    await userEvent.type(screen.getByLabelText(copy.positionLabel), "9");

    expect(onPositionChange).toHaveBeenLastCalledWith("4");
  });

  it("rejects non-numeric input", async () => {
    const onPositionChange = vi.fn();
    renderField({ onPositionChange, placement: "specific", position: "" });

    await userEvent.type(screen.getByLabelText(copy.positionLabel), "a");

    expect(onPositionChange).not.toHaveBeenCalled();
  });

  it("renders the relative picker and before/after toggle for a relative placement", () => {
    renderField({ placement: "relative", relativeBookId: null });

    expect(screen.getByRole("button", { name: copy.relativeBookLabel })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: copy.relativeBefore })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: copy.relativeAfter })).toBeInTheDocument();
  });

  it("renders a reactive result preview", () => {
    renderField({ outcome: { kind: "specific", position: 2 }, placement: "specific" });

    expect(screen.getByText(copy.resultSpecific.replace("{position}", "2"))).toBeInTheDocument();
  });
});

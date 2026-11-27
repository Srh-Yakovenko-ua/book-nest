import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { MaintenanceScreen } from "./maintenance-screen";

const maintenance = messages.maintenance;

describe("MaintenanceScreen", () => {
  it("shows the maintenance art inside the status region", () => {
    renderWithProviders(<MaintenanceScreen checking={false} longWait={false} onRetry={vi.fn()} />);

    expect(within(screen.getByRole("status")).getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining("maintenance.png"),
    );
  });

  it("asks for a new check when the reader presses retry", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<MaintenanceScreen checking={false} longWait={false} onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: maintenance.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

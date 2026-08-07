import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { useMaintenanceStore } from "../model/maintenance-store";
import { MaintenanceGate } from "./maintenance-gate";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  useMaintenanceStore.getState().end();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MaintenanceGate", () => {
  it("stays out of the way until maintenance is reported", () => {
    renderWithProviders(<MaintenanceGate />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("takes over the screen and tells the user nothing is required of them", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    useMaintenanceStore.getState().start();

    renderWithProviders(<MaintenanceGate />);

    expect(await screen.findByText("Технічні роботи")).toBeInTheDocument();
    expect(screen.getByText(/сторінка оновиться автоматично/)).toBeInTheDocument();
  });

  it("lets the user back in on its own once health recovers", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    useMaintenanceStore.getState().start();

    renderWithProviders(<MaintenanceGate />);

    await waitFor(() => {
      expect(useMaintenanceStore.getState().active).toBe(false);
    });
    expect(screen.queryByText("Технічні роботи")).not.toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { StatisticsDetailSurface } from "./statistics-detail-surface";

const SURFACE = {
  close: "Close the day",
  label: "Open the day",
  title: "March 10",
  trigger: "10",
} as const;

beforeEach(() => {
  vi.stubGlobal("innerWidth", 1280);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openAndCloseFromInside(trigger: HTMLElement) {
  const user = userEvent.setup();
  await user.click(trigger);
  const content = await screen.findByRole("dialog", { name: SURFACE.title });
  await user.click(within(content).getByRole("button", { name: SURFACE.close }));
  await waitFor(() =>
    expect(screen.queryByRole("dialog", { name: SURFACE.title })).not.toBeInTheDocument(),
  );
}

function renderSurface(onCloseAutoFocus?: (event: Event) => void) {
  return renderWithProviders(
    <StatisticsDetailSurface
      detail={({ close }) => (
        <button onClick={close} type="button">
          {SURFACE.close}
        </button>
      )}
      label={SURFACE.label}
      onCloseAutoFocus={onCloseAutoFocus}
      title={SURFACE.title}
    >
      {SURFACE.trigger}
    </StatisticsDetailSurface>,
  );
}

describe("StatisticsDetailSurface popover on desktop", () => {
  it("returns focus to the trigger after closing from inside by default", async () => {
    renderSurface();
    const trigger = screen.getByRole("button", { name: SURFACE.label });

    await openAndCloseFromInside(trigger);

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("hands the close focus to the caller once the content has left", async () => {
    const onClosed = vi.fn(() => screen.queryByRole("dialog", { name: SURFACE.title }) === null);
    renderSurface((event) => {
      event.preventDefault();
      onClosed();
    });
    const trigger = screen.getByRole("button", { name: SURFACE.label });

    await openAndCloseFromInside(trigger);

    await waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
    expect(onClosed).toHaveReturnedWith(true);
    expect(trigger).not.toHaveFocus();
  });
});

describe("StatisticsDetailSurface drawer on mobile", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 375);
  });

  async function openAndCloseDrawerFromInside(trigger: HTMLElement) {
    const user = userEvent.setup();
    await user.click(trigger);
    const drawer = await screen.findByRole("dialog", { name: SURFACE.title });
    await user.click(within(drawer).getByRole("button", { name: SURFACE.close }));
    await waitFor(() => expect(drawer).toHaveAttribute("data-state", "closed"));
    fireEvent.animationEnd(drawer);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: SURFACE.title })).not.toBeInTheDocument(),
    );
  }

  it("returns focus to the trigger once the simulated exit animation ends, by default", async () => {
    renderSurface();
    const trigger = await screen.findByRole("button", { name: SURFACE.label });
    await waitFor(() => expect(trigger).toHaveAttribute("data-slot", "drawer-trigger"));

    await openAndCloseDrawerFromInside(trigger);

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("hands the close focus to the caller once the simulated exit animation ends", async () => {
    const onClosed = vi.fn(() => screen.queryByRole("dialog", { name: SURFACE.title }) === null);
    renderSurface((event) => {
      event.preventDefault();
      onClosed();
    });
    const trigger = await screen.findByRole("button", { name: SURFACE.label });
    await waitFor(() => expect(trigger).toHaveAttribute("data-slot", "drawer-trigger"));

    await openAndCloseDrawerFromInside(trigger);

    await waitFor(() => expect(onClosed).toHaveBeenCalledOnce());
    expect(onClosed).toHaveReturnedWith(true);
    expect(trigger).not.toHaveFocus();
  });
});

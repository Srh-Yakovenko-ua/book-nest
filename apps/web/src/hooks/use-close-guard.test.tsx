import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { useCloseGuard, useReleaseOrphanedHistorySentinel } from "./use-close-guard";

type GuardState = {
  guardHistory?: boolean;
  isDirty: boolean;
  isOpen?: boolean;
  isPending?: boolean;
};

const discardChanges = messages.common.discardChanges;

const SENTINEL_ENTRY = {
  key: "sentinel-entry",
  storageKey: "closeGuard:entryKey",
} as const;

function closeButton() {
  return screen.getByRole("button", { name: "Close draft" });
}

function GuardProbe({
  guardHistory = false,
  isDirty,
  isOpen = true,
  isPending = false,
  onClose,
  onLeave,
}: GuardState & { onClose: () => void; onLeave: () => void }) {
  const guard = useCloseGuard({
    focusFallback: () => undefined,
    guardHistory,
    isDirty,
    isOpen,
    isPending,
    onClose,
    onLeave,
  });

  return (
    <>
      <button onClick={guard.requestClose} type="button">
        Close draft
      </button>
      <DiscardChangesDialog {...guard.discardDialog} />
    </>
  );
}

function renderGuard(state: GuardState) {
  const onClose = vi.fn();
  const onLeave = vi.fn();
  renderWithProviders(<GuardProbe {...state} onClose={onClose} onLeave={onLeave} />);
  return { onClose, onLeave };
}

function SentinelReleaseProbe() {
  useReleaseOrphanedHistorySentinel();
  return null;
}

function spyOnHistoryBack() {
  return vi.spyOn(window.history, "back").mockImplementation(() => undefined);
}

function stubCurrentEntryKey(key: string) {
  vi.stubGlobal("navigation", { currentEntry: { key } });
}

function unloadIsWarned(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("useCloseGuard closing", () => {
  it("closes at once when nothing has changed", async () => {
    const { onClose } = renderGuard({ isDirty: false });

    await userEvent.click(closeButton());

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before throwing away a changed draft", async () => {
    const { onClose } = renderGuard({ isDirty: true });

    await userEvent.click(closeButton());

    expect(
      await screen.findByRole("alertdialog", { name: discardChanges.title }),
    ).toHaveAccessibleDescription(discardChanges.description);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes once throwing away the changed draft is confirmed", async () => {
    const { onClose } = renderGuard({ isDirty: true });

    await userEvent.click(closeButton());
    await userEvent.click(
      within(await screen.findByRole("alertdialog", { name: discardChanges.title })).getByRole(
        "button",
        { name: discardChanges.confirm },
      ),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    { draft: "clean", isDirty: false },
    { draft: "changed", isDirty: true },
  ])("ignores a close request while a $draft draft is saving", async ({ isDirty }) => {
    const { onClose } = renderGuard({ isDirty, isPending: true });

    await userEvent.click(closeButton());

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});

describe("useCloseGuard page unload", () => {
  it("warns before the page unloads while a changed draft is open", () => {
    renderGuard({ isDirty: true });

    expect(unloadIsWarned()).toBe(true);
  });

  it.each([
    { draft: "a clean draft is open", isDirty: false, isOpen: true },
    { draft: "a changed draft is already closed", isDirty: true, isOpen: false },
  ])("lets the page unload while $draft", ({ isDirty, isOpen }) => {
    renderGuard({ isDirty, isOpen });

    expect(unloadIsWarned()).toBe(false);
  });
});

describe("useCloseGuard browser history", () => {
  it("asks instead of leaving when the browser goes back from a changed draft", async () => {
    const { onClose, onLeave } = renderGuard({ guardHistory: true, isDirty: true });

    act(() => {
      window.history.back();
    });

    expect(
      await screen.findByRole("alertdialog", { name: discardChanges.title }),
    ).toBeInTheDocument();
    expect(onLeave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("history sentinel recognised by its navigation entry key", () => {
  beforeEach(() => {
    window.history.replaceState(null, "");
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  describe("useCloseGuard", () => {
    it("steps back off its sentinel entry on close after the state marker was replaced", async () => {
      stubCurrentEntryKey(SENTINEL_ENTRY.key);
      const historyBack = spyOnHistoryBack();
      const onClose = vi.fn();
      const onLeave = vi.fn();
      const view = renderWithProviders(
        <GuardProbe guardHistory isDirty onClose={onClose} onLeave={onLeave} />,
      );

      window.history.replaceState(null, "");
      await userEvent.click(closeButton());
      const prompt = await screen.findByRole("alertdialog", { name: discardChanges.title });
      await userEvent.click(within(prompt).getByRole("button", { name: discardChanges.confirm }));
      view.rerender(
        <GuardProbe guardHistory isDirty isOpen={false} onClose={onClose} onLeave={onLeave} />,
      );

      expect(historyBack).toHaveBeenCalledOnce();
    });
  });

  describe("useReleaseOrphanedHistorySentinel", () => {
    it("steps back once when the current entry key is the stored sentinel key", () => {
      stubCurrentEntryKey(SENTINEL_ENTRY.key);
      window.sessionStorage.setItem(SENTINEL_ENTRY.storageKey, SENTINEL_ENTRY.key);
      const historyBack = spyOnHistoryBack();

      renderWithProviders(<SentinelReleaseProbe />);

      expect(historyBack).toHaveBeenCalledOnce();
    });

    it("stays when the current entry key differs from the stored sentinel key", () => {
      stubCurrentEntryKey("another-entry");
      window.sessionStorage.setItem(SENTINEL_ENTRY.storageKey, SENTINEL_ENTRY.key);
      const historyBack = spyOnHistoryBack();

      renderWithProviders(<SentinelReleaseProbe />);

      expect(historyBack).not.toHaveBeenCalled();
    });

    it("stays when the browser has no navigation api and the entry has no marker", () => {
      window.sessionStorage.setItem(SENTINEL_ENTRY.storageKey, SENTINEL_ENTRY.key);
      const historyBack = spyOnHistoryBack();

      renderWithProviders(<SentinelReleaseProbe />);

      expect(historyBack).not.toHaveBeenCalled();
    });
  });
});

import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { ImageViewerDialog } from "./image-viewer-dialog";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImageViewerDialog", () => {
  it("shows the image with its alt, the title, and the caption when open", () => {
    renderWithProviders(
      <ImageViewerDialog
        alt="Book cover full size"
        caption="cover.webp · 1066 × 1600"
        onOpenChange={() => {}}
        open
        src="/cover-full.webp"
        title="Book cover"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Book cover" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Book cover full size" })).toBeInTheDocument();
    expect(screen.getByText("cover.webp · 1066 × 1600")).toBeInTheDocument();
  });

  it("falls back to the alt as the dialog name when no title is given", () => {
    renderWithProviders(
      <ImageViewerDialog
        alt="Book cover full size"
        onOpenChange={() => {}}
        open
        src="/cover-full.webp"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Book cover full size" })).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    renderWithProviders(
      <ImageViewerDialog
        alt="Book cover full size"
        onOpenChange={() => {}}
        open={false}
        src="/cover-full.webp"
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a busy status overlay, hides the close button, and disables actions while busy", () => {
    renderWithProviders(
      <ImageViewerDialog
        alt="Book cover full size"
        busy
        busyLabel="Replacing cover…"
        onOpenChange={() => {}}
        onReplace={() => {}}
        open
        replaceLabel="Replace"
        src="/cover-full.webp"
        title="Book cover"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Replacing cover…");
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace" })).toBeDisabled();
  });

  it("opens the source in a new tab instead of downloading an error body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ blob: vi.fn(), ok: false, status: 403 });
    const openMock = vi.fn();
    const clickMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", openMock);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickMock);

    renderWithProviders(
      <ImageViewerDialog
        alt="Book cover full size"
        downloadLabel="Download"
        downloadName="cover.webp"
        onOpenChange={() => {}}
        open
        src="/cover-full.webp"
        title="Book cover"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(openMock).toHaveBeenCalledWith("/cover-full.webp", "_blank", "noopener"),
    );
    expect(clickMock).not.toHaveBeenCalled();
  });
});

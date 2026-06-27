import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/test-utils";

import { ImageViewerDialog } from "./image-viewer-dialog";

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
});

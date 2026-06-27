import "@testing-library/jest-dom/vitest";

import type { MediaView } from "@app/shared";

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import type { CoverState } from "../model/cover-state";

import { CoverField } from "./cover-field";

vi.mock("@/features/media/lib/crop-image", () => ({
  CropImageError: class CropImageError extends Error {},
  cropImageToFile: vi.fn(() =>
    Promise.resolve(new File(["cropped"], "cover.webp", { type: "image/webp" })),
  ),
}));

vi.mock("react-easy-crop", () => ({
  default: ({
    onCropComplete,
  }: {
    onCropComplete: (
      area: { height: number; width: number; x: number; y: number },
      areaPixels: { height: number; width: number; x: number; y: number },
    ) => void;
  }) => (
    <button
      onClick={() =>
        onCropComplete(
          { height: 150, width: 100, x: 0, y: 0 },
          { height: 150, width: 100, x: 0, y: 0 },
        )
      }
      type="button"
    >
      complete crop
    </button>
  ),
}));

const existingMedia: MediaView = {
  contentType: "image/webp",
  createdAt: "2026-06-27T00:00:00.000Z",
  height: 1600,
  id: "media-1",
  kind: "book_cover",
  name: "cover.webp",
  sizeBytes: 234567,
  urls: { card: "/cover-card.webp", full: "/cover-full.webp", thumb: "/cover-thumb.webp" },
  width: 1066,
};

function Harness({
  hadInitialCover = false,
  initial,
}: {
  hadInitialCover?: boolean;
  initial: CoverState;
}) {
  const [state, setState] = useState<CoverState>(initial);
  return <CoverField hadInitialCover={hadInitialCover} onChange={setState} state={state} />;
}

function pngFile() {
  return new File(["image"], "pick.png", { type: "image/png" });
}

function selectedState(): CoverState {
  return {
    file: new File(["bytes"], "cover.webp", { type: "image/webp" }),
    kind: "selected",
    previewUrl: "blob:selected-cover",
  };
}

describe("CoverField", () => {
  it("opens the crop dialog after selecting a file", async () => {
    renderWithProviders(<Harness initial={{ kind: "empty" }} />);

    await userEvent.upload(screen.getByLabelText("Перетягніть зображення сюди"), pngFile());

    expect(await screen.findByText("Обрізати обкладинку")).toBeInTheDocument();
  });

  it("shows the preview and replace and remove actions after applying a crop", async () => {
    renderWithProviders(<Harness initial={{ kind: "empty" }} />);

    await userEvent.upload(screen.getByLabelText("Перетягніть зображення сюди"), pngFile());
    await userEvent.click(await screen.findByRole("button", { name: "complete crop" }));
    await userEvent.click(await screen.findByRole("button", { name: "Застосувати" }));

    expect(await screen.findByRole("img", { name: "Обкладинка книги" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Замінити обкладинку" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити обкладинку" })).toBeInTheDocument();
  });

  it("removes the cover immediately in create mode without confirmation", async () => {
    renderWithProviders(<Harness initial={selectedState()} />);

    await userEvent.click(screen.getByRole("button", { name: "Видалити обкладинку" }));

    expect(screen.queryByRole("img", { name: "Обкладинка книги" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Перетягніть зображення сюди")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks for confirmation before removing an existing cover in edit mode", async () => {
    renderWithProviders(
      <Harness hadInitialCover initial={{ kind: "existing", media: existingMedia }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Видалити обкладинку" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Видалити обкладинку?")).toBeInTheDocument();
  });

  it("clears the cover when the removal is confirmed", async () => {
    renderWithProviders(
      <Harness hadInitialCover initial={{ kind: "existing", media: existingMedia }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Видалити обкладинку" }));
    await userEvent.click(await screen.findByRole("button", { name: "Видалити" }));

    await waitFor(() =>
      expect(screen.queryByRole("img", { name: "Обкладинка книги" })).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Перетягніть зображення сюди")).toBeInTheDocument();
  });

  it("keeps the cover when the removal is cancelled", async () => {
    renderWithProviders(
      <Harness hadInitialCover initial={{ kind: "existing", media: existingMedia }} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Видалити обкладинку" }));
    await userEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByRole("img", { name: "Обкладинка книги" })).toBeInTheDocument();
  });
});

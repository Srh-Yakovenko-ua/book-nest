import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import enMessages from "@/messages/en.json";
import ukMessages from "@/messages/uk.json";
import { fireEvent, renderWithProviders, screen } from "@/test-utils";

import { Upload } from "./upload";

describe("Upload", () => {
  it("renders the separator in the active locale", () => {
    const { unmount } = renderWithProviders(<Upload files={[]} onFilesChange={vi.fn()} />);
    expect(screen.getByText(ukMessages.upload.or)).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Upload files={[]} onFilesChange={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enMessages.upload.or)).toBeInTheDocument();
    expect(screen.queryByText(ukMessages.upload.or)).not.toBeInTheDocument();
  });

  it("shows the default title and browse label in the active locale", () => {
    const { unmount } = renderWithProviders(<Upload files={[]} onFilesChange={vi.fn()} />);
    expect(screen.getByText(ukMessages.upload.title)).toBeInTheDocument();
    expect(screen.getByText(ukMessages.upload.browse)).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <Upload files={[]} onFilesChange={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText(enMessages.upload.title)).toBeInTheDocument();
    expect(screen.getByText(enMessages.upload.browse)).toBeInTheDocument();
    expect(screen.queryByText(ukMessages.upload.title)).not.toBeInTheDocument();
  });

  it("asks to drop the file while it is dragged over", () => {
    renderWithProviders(<Upload files={[]} onFilesChange={vi.fn()} />);
    const dropZone = screen.getByRole("button", { name: new RegExp(ukMessages.upload.title) });

    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);

    expect(screen.getByText(ukMessages.upload.dropToUpload)).toBeInTheDocument();
    expect(screen.queryByText(ukMessages.upload.title)).not.toBeInTheDocument();
  });

  it("names the file in the remove button", () => {
    const files = [
      new File(["front"], "cover.png", { type: "image/png" }),
      new File(["back"], "back.png", { type: "image/png" }),
    ];
    renderWithProviders(<Upload files={files} multiple onFilesChange={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: ukMessages.upload.remove.replace("{name}", "cover.png") }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: ukMessages.upload.remove.replace("{name}", "back.png") }),
    ).toBeInTheDocument();
  });

  it.each([
    { bytes: 1536, label: ukMessages.upload.sizeKilobytes.replace("{size}", "2") },
    { bytes: 1_572_864, label: ukMessages.upload.sizeMegabytes.replace("{size}", "1.5") },
    { bytes: 100, label: ukMessages.upload.sizeKilobytes.replace("{size}", "1") },
    { bytes: 1_048_000, label: ukMessages.upload.sizeKilobytes.replace("{size}", "1023") },
  ])("formats file sizes: $bytes bytes as $label", ({ bytes, label }) => {
    const file = new File([new Uint8Array(bytes)], "cover.png", { type: "image/png" });
    renderWithProviders(<Upload files={[file]} onFilesChange={vi.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

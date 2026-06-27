import { describe, expect, it } from "vitest";

import { mediaDownloadName } from "./download-filename";

describe("mediaDownloadName", () => {
  it("swaps the original extension for the webp extension of the stored bytes", () => {
    expect(mediaDownloadName({ contentType: "image/webp", name: "photo.jpg" })).toBe("photo.webp");
  });

  it("keeps a name that already matches the content type", () => {
    expect(mediaDownloadName({ contentType: "image/webp", name: "cover.webp" })).toBe("cover.webp");
  });

  it("falls back to a default base when the name is null", () => {
    expect(mediaDownloadName({ contentType: "image/webp", name: null })).toBe("cover.webp");
  });

  it("falls back to a default base when the name is only an extension", () => {
    expect(mediaDownloadName({ contentType: "image/png", name: ".png" })).toBe("cover.png");
  });

  it("leaves the base untouched when the content type is unknown", () => {
    expect(mediaDownloadName({ contentType: "application/octet-stream", name: "file.bin" })).toBe(
      "file",
    );
  });
});

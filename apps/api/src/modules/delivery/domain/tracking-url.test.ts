import { describe, expect, it } from "vitest";

import { buildTrackingUrlFromTemplate, resolveTrackingUrl } from "./tracking-url.js";

const TEMPLATE = "https://track.example.com/parcel/{trackingNumber}";

describe("buildTrackingUrlFromTemplate", () => {
  it("puts the tracking number into the carrier template", () => {
    expect(buildTrackingUrlFromTemplate({ template: TEMPLATE, trackingNumber: "TTN-1" })).toBe(
      "https://track.example.com/parcel/TTN-1",
    );
  });

  it("escapes a tracking number that carries URL punctuation", () => {
    expect(
      buildTrackingUrlFromTemplate({ template: TEMPLATE, trackingNumber: "20 45/06?x=1&y=2" }),
    ).toBe("https://track.example.com/parcel/20%2045%2F06%3Fx%3D1%26y%3D2");
  });

  it("keeps the carrier host even when the tracking number looks like another host", () => {
    const url = buildTrackingUrlFromTemplate({
      template: TEMPLATE,
      trackingNumber: "evil.example.com/steal",
    });

    expect(url === null ? null : new URL(url).host).toBe("track.example.com");
  });

  it("trims a padded tracking number before building the URL", () => {
    expect(buildTrackingUrlFromTemplate({ template: TEMPLATE, trackingNumber: "  TTN-1  " })).toBe(
      "https://track.example.com/parcel/TTN-1",
    );
  });

  it("builds nothing when the carrier has no template", () => {
    expect(buildTrackingUrlFromTemplate({ template: null, trackingNumber: "TTN-1" })).toBeNull();
  });

  it("builds nothing when the template is only whitespace", () => {
    expect(buildTrackingUrlFromTemplate({ template: "   ", trackingNumber: "TTN-1" })).toBeNull();
  });

  it("builds nothing when there is no tracking number yet", () => {
    expect(buildTrackingUrlFromTemplate({ template: TEMPLATE, trackingNumber: null })).toBeNull();
  });

  it("builds nothing when the tracking number is only whitespace", () => {
    expect(buildTrackingUrlFromTemplate({ template: TEMPLATE, trackingNumber: "   " })).toBeNull();
  });

  it("builds nothing when the template has no place to put the number", () => {
    expect(
      buildTrackingUrlFromTemplate({
        template: "https://track.example.com/parcel",
        trackingNumber: "TTN-1",
      }),
    ).toBeNull();
  });

  it("refuses a javascript template", () => {
    expect(
      buildTrackingUrlFromTemplate({
        template: "javascript:alert('{trackingNumber}')",
        trackingNumber: "TTN-1",
      }),
    ).toBeNull();
  });

  it("refuses a data template", () => {
    expect(
      buildTrackingUrlFromTemplate({
        template: "data:text/html,{trackingNumber}",
        trackingNumber: "TTN-1",
      }),
    ).toBeNull();
  });

  it("refuses a template that is nothing but the tracking number", () => {
    expect(
      buildTrackingUrlFromTemplate({
        template: "{trackingNumber}",
        trackingNumber: "https://evil.example.com",
      }),
    ).toBeNull();
  });

  it("refuses a scheme-relative template that would let the number pick the host", () => {
    expect(
      buildTrackingUrlFromTemplate({
        template: "//{trackingNumber}/parcel",
        trackingNumber: "evil.example.com",
      }),
    ).toBeNull();
  });
});

describe("resolveTrackingUrl", () => {
  it("prefers the URL the reader typed over the one the template would build", () => {
    expect(
      resolveTrackingUrl({
        template: TEMPLATE,
        trackingNumber: "TTN-1",
        trackingUrl: "https://my-own-link.example.com/parcel",
      }),
    ).toBe("https://my-own-link.example.com/parcel");
  });

  it("builds from the template once the typed URL is cleared", () => {
    expect(
      resolveTrackingUrl({ template: TEMPLATE, trackingNumber: "TTN-1", trackingUrl: null }),
    ).toBe("https://track.example.com/parcel/TTN-1");
  });

  it("treats a whitespace-only typed URL as cleared and falls back to the template", () => {
    expect(
      resolveTrackingUrl({ template: TEMPLATE, trackingNumber: "TTN-1", trackingUrl: "   " }),
    ).toBe("https://track.example.com/parcel/TTN-1");
  });

  it("has nothing to offer when neither a typed URL nor a template exists", () => {
    expect(
      resolveTrackingUrl({ template: null, trackingNumber: "TTN-1", trackingUrl: null }),
    ).toBeNull();
  });
});

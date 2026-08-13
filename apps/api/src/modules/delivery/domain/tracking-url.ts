import type { Nullable } from "@app/shared";

import { TRACKING_URL_TEMPLATE_PLACEHOLDER } from "@app/shared";

const TRACKING_URL_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:"]);

const PLACEHOLDER_PROBE = "trackingnumberprobe";

export function buildTrackingUrlFromTemplate({
  template,
  trackingNumber,
}: {
  template: Nullable<string>;
  trackingNumber: Nullable<string>;
}): Nullable<string> {
  const filledTemplate = template?.trim() ?? "";
  const filledNumber = trackingNumber?.trim() ?? "";
  if (filledTemplate.length === 0 || filledNumber.length === 0) {
    return null;
  }
  if (!filledTemplate.includes(TRACKING_URL_TEMPLATE_PLACEHOLDER)) {
    return null;
  }
  if (placesPlaceholderInAuthority(filledTemplate)) {
    return null;
  }

  return toHttpUrl(
    filledTemplate.replaceAll(TRACKING_URL_TEMPLATE_PLACEHOLDER, encodeURIComponent(filledNumber)),
  );
}

export function resolveTrackingUrl({
  template,
  trackingNumber,
  trackingUrl,
}: {
  template: Nullable<string>;
  trackingNumber: Nullable<string>;
  trackingUrl: Nullable<string>;
}): Nullable<string> {
  const typedUrl = trackingUrl?.trim() ?? "";
  if (typedUrl.length > 0) {
    return toHttpUrl(typedUrl);
  }

  return buildTrackingUrlFromTemplate({ template, trackingNumber });
}

function placesPlaceholderInAuthority(template: string): boolean {
  const probe = template.replaceAll(TRACKING_URL_TEMPLATE_PLACEHOLDER, PLACEHOLDER_PROBE);
  if (!URL.canParse(probe)) {
    return true;
  }

  return new URL(probe).host.includes(PLACEHOLDER_PROBE);
}

function toHttpUrl(candidate: string): Nullable<string> {
  if (!URL.canParse(candidate)) {
    return null;
  }

  return TRACKING_URL_PROTOCOLS.has(new URL(candidate).protocol) ? candidate : null;
}

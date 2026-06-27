export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const ACCEPT_ATTR = [
  ...ACCEPTED_IMAGE_TYPES,
  "image/heic",
  "image/heif",
  ".heic",
  ".heif",
].join(",");

export const COVER_ASPECT = 3 / 4;

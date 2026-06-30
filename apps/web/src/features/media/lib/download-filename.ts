type MediaDownloadNameInput = {
  contentType: string;
  name: null | string;
};

const FALLBACK_BASE = "cover";

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function mediaDownloadName({ contentType, name }: MediaDownloadNameInput): string {
  const base = stripExtension(name);
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType];
  return extension === undefined ? base : `${base}.${extension}`;
}

function stripExtension(name: null | string): string {
  if (name === null) return FALLBACK_BASE;
  const stripped = name.replace(/\.[^./\\]+$/, "");
  return stripped.length > 0 ? stripped : FALLBACK_BASE;
}

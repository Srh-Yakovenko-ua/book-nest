import { posix as posixPath } from "node:path";

const THUMB_FILE_NAME = "thumb.webp";

export function thumbKey(storageKey: string): string {
  return `${posixPath.dirname(storageKey)}/${THUMB_FILE_NAME}`;
}

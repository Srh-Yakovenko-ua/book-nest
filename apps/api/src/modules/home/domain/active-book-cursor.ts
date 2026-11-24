import type { Nullable } from "@app/shared";

import { isoDay } from "@app/shared";
import { z } from "zod";

import type { ActiveBookOrderKey } from "./active-book-order.js";

const CURSOR_ENCODING = "base64url";

const ActiveBookCursorSchema = z.object({
  id: z.uuid(),
  key: isoDay().nullable(),
});

export function decodeActiveBookCursor(value: string | undefined): Nullable<ActiveBookOrderKey> {
  if (value === undefined) {
    return null;
  }
  const parsed = ActiveBookCursorSchema.safeParse(readCursorPayload(value));
  return parsed.success ? parsed.data : null;
}

export function encodeActiveBookCursor(cursor: ActiveBookOrderKey): string {
  return Buffer.from(JSON.stringify({ id: cursor.id, key: cursor.key }), "utf8").toString(
    CURSOR_ENCODING,
  );
}

function readCursorPayload(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, CURSOR_ENCODING).toString("utf8"));
  } catch {
    return null;
  }
}

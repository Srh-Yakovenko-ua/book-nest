import type { Nullable } from "@app/shared";
import type { z } from "zod";

import { BadRequestError } from "../../../core/exceptions/errors.js";

const STATISTICS_CURSOR_MESSAGE = "Invalid pagination cursor";

export const statisticsCursorCodec = {
  decode<TSchema extends z.ZodType>({
    schema,
    value,
  }: {
    schema: TSchema;
    value: string | undefined;
  }): Nullable<z.infer<TSchema>> {
    if (value === undefined) {
      return null;
    }

    const parsed = schema.safeParse(readCursorPayload(value));
    if (!parsed.success) {
      throw new BadRequestError(STATISTICS_CURSOR_MESSAGE);
    }
    return parsed.data;
  },
  encode(payload: Record<string, number | string>): string {
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  },
};

function readCursorPayload(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

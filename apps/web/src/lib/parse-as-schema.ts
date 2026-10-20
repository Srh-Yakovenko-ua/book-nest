import type { z } from "zod";

import { createParser } from "nuqs/server";

export function parseAsSchema<T>(schema: z.ZodType<T>) {
  return createParser({
    parse: (value: string) => {
      const result = schema.safeParse(value);
      return result.success ? result.data : null;
    },
    serialize: (value: T) => String(value),
  });
}

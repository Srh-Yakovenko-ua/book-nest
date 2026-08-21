import { createParser } from "nuqs/server";
import { z } from "zod";

const ContactIdSchema = z.uuid();

export const parseAsContactId = createParser({
  parse: (value: string) => ContactIdSchema.safeParse(value).data ?? null,
  serialize: (value: string) => value,
}).withDefault("");

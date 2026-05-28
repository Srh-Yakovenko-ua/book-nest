import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import type { ZodType } from "zod";

import { Injectable } from "@nestjs/common";

import { BadRequestError } from "../exceptions/errors.js";
import { mapZodError } from "../zod-error.js";

@Injectable()
export class ZodQueryPipe<Schema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: Schema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type !== "query") return value;

    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestError("Invalid query params", {
        fields: mapZodError(parsed.error).errorsMessages,
      });
    }
    return parsed.data;
  }
}

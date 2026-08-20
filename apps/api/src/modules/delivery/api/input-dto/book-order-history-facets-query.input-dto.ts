import { BookOrderHistoryFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderHistoryFacetsQueryDto extends createZodDto(
  BookOrderHistoryFacetsQuerySchema,
) {}

import { BookOrderHistoryFacetsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookOrderHistoryFacetsViewDto extends createZodDto(BookOrderHistoryFacetsViewSchema) {}

import { BookFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BookFacetsQueryDto extends createZodDto(BookFacetsQuerySchema) {}

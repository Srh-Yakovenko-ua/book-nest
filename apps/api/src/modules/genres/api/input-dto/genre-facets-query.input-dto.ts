import { GenreFacetsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class GenreFacetsQueryDto extends createZodDto(GenreFacetsQuerySchema) {}

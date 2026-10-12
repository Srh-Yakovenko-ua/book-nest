import { SpeciesBrowseQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesBrowseQueryDto extends createZodDto(SpeciesBrowseQuerySchema) {}

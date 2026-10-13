import { SpeciesBrowsePageSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesBrowsePageDto extends createZodDto(SpeciesBrowsePageSchema) {}

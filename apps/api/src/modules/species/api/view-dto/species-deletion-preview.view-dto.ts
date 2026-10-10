import { SpeciesDeletionPreviewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SpeciesDeletionPreviewDto extends createZodDto(SpeciesDeletionPreviewSchema) {}

import { SeriesOrderFixPreviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderFixPreviewViewDto extends createZodDto(SeriesOrderFixPreviewViewSchema) {}

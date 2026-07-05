import { SeriesOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOverviewViewDto extends createZodDto(SeriesOverviewViewSchema) {}

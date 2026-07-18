import { TimelineOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineOverviewViewDto extends createZodDto(TimelineOverviewViewSchema) {}

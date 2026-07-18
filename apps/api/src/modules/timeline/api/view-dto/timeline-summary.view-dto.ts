import { TimelineSummaryViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TimelineSummaryViewDto extends createZodDto(TimelineSummaryViewSchema) {}

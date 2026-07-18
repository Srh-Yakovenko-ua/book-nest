import { SeriesOrderIssuesViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderIssuesViewDto extends createZodDto(SeriesOrderIssuesViewSchema) {}

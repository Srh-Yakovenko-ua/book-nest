import { SeriesOrderIssuesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SeriesOrderIssuesQueryDto extends createZodDto(SeriesOrderIssuesQuerySchema) {}

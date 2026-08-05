import { TrashedSeriesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedSeriesQueryDto extends createZodDto(TrashedSeriesQuerySchema) {}

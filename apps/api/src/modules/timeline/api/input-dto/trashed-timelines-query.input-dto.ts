import { TrashedTimelinesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedTimelinesQueryDto extends createZodDto(TrashedTimelinesQuerySchema) {}

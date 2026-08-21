import { InTransitQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class InTransitQueryDto extends createZodDto(InTransitQuerySchema) {}

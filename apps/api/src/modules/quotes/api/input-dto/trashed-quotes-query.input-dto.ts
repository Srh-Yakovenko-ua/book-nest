import { TrashedQuotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedQuotesQueryDto extends createZodDto(TrashedQuotesQuerySchema) {}

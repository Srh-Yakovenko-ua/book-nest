import { QuotesQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class QuotesQueryDto extends createZodDto(QuotesQuerySchema) {}

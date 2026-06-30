import { BulkReadingStatusInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkReadingStatusInputDto extends createZodDto(BulkReadingStatusInputSchema) {}

import { BulkPagesCountInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkPagesCountInputDto extends createZodDto(BulkPagesCountInputSchema) {}

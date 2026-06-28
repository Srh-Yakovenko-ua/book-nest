import { BulkBookIdsSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkBookIdsDto extends createZodDto(BulkBookIdsSchema) {}

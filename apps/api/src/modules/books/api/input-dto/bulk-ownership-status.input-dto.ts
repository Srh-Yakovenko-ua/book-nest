import { BulkOwnershipStatusInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class BulkOwnershipStatusInputDto extends createZodDto(BulkOwnershipStatusInputSchema) {}

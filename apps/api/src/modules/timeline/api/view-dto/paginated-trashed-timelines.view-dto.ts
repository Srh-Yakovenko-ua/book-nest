import { PaginatedTrashedTimelinesSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class PaginatedTrashedTimelinesDto extends createZodDto(PaginatedTrashedTimelinesSchema) {}

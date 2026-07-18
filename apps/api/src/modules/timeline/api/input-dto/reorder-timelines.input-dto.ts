import { ReorderTimelinesInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ReorderTimelinesInputDto extends createZodDto(ReorderTimelinesInputSchema) {}

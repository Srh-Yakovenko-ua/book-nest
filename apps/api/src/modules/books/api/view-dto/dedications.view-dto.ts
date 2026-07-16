import { DedicationsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DedicationsViewDto extends createZodDto(DedicationsViewSchema) {}

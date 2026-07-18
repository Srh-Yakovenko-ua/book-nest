import { DedicationsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class DedicationsQueryDto extends createZodDto(DedicationsQuerySchema) {}

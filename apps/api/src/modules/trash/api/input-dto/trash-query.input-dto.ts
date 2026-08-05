import { TrashQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashQueryDto extends createZodDto(TrashQuerySchema) {}

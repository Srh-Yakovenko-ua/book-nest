import { ActiveMoneyAgeQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ActiveMoneyAgeQueryDto extends createZodDto(ActiveMoneyAgeQuerySchema) {}

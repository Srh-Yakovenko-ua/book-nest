import { ActiveMoneyAgeResponseSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ActiveMoneyAgeViewDto extends createZodDto(ActiveMoneyAgeResponseSchema) {}

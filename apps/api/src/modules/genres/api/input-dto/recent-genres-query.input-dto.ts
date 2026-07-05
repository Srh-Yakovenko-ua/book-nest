import { RecentGenresQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class RecentGenresQueryDto extends createZodDto(RecentGenresQuerySchema) {}

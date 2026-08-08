import { ListOverviewViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class ListOverviewViewDto extends createZodDto(ListOverviewViewSchema) {}

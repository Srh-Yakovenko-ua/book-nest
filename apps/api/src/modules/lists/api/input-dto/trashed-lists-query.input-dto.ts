import { TrashedListsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class TrashedListsQueryDto extends createZodDto(TrashedListsQuerySchema) {}

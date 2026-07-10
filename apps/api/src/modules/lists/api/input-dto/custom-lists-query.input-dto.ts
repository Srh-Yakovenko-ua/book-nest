import { CustomListsQuerySchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CustomListsQueryDto extends createZodDto(CustomListsQuerySchema) {}

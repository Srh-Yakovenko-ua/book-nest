import { CustomListDetailSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CustomListDetailDto extends createZodDto(CustomListDetailSchema) {}

import { CustomListCardSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CustomListCardDto extends createZodDto(CustomListCardSchema) {}

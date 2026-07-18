import { CreateTagSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateTagDto extends createZodDto(CreateTagSchema) {}

import { UpdateTagSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}

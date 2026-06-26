import { CreateGenreSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateGenreDto extends createZodDto(CreateGenreSchema) {}

import { CreateEventRelationInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class CreateEventRelationInputDto extends createZodDto(CreateEventRelationInputSchema) {}

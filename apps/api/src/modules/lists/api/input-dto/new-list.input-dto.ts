import { NewListInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class NewListInputDto extends createZodDto(NewListInputSchema) {}

import { UpdateListInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateListInputDto extends createZodDto(UpdateListInputSchema) {}

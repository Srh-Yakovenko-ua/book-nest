import { SetBookListsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SetBookListsInputDto extends createZodDto(SetBookListsInputSchema) {}

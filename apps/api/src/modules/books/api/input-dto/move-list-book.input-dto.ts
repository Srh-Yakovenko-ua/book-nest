import { MoveListBookInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class MoveListBookInputDto extends createZodDto(MoveListBookInputSchema) {}

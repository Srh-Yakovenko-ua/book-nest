import { UpdateSettingsInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class UpdateSettingsInputDto extends createZodDto(UpdateSettingsInputSchema) {}

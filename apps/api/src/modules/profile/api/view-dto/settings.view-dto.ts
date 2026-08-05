import { SettingsViewSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export class SettingsViewDto extends createZodDto(SettingsViewSchema) {}

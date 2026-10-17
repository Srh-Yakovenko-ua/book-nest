import { CharacterBundleAnyVersionSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export const CharacterImportBundleDto = createZodDto(CharacterBundleAnyVersionSchema);

Object.defineProperty(CharacterImportBundleDto, "name", {
  value: "CharacterImportBundleDto",
});

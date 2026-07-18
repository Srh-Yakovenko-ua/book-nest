import { CreateCharacterInBookSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export const CreateCharacterInBookInputDto = createZodDto(CreateCharacterInBookSchema);

Object.defineProperty(CreateCharacterInBookInputDto, "name", {
  value: "CreateCharacterInBookDto",
});

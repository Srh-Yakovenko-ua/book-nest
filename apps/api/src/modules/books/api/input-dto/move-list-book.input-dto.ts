import { MoveListBookInputSchema } from "@app/shared";
import { createZodDto } from "nestjs-zod";

export const MoveListBookInputDto = createZodDto(MoveListBookInputSchema);

Object.defineProperty(MoveListBookInputDto, "name", {
  value: "MoveListBookInputDto",
});

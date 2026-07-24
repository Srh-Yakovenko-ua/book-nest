import type { MediaUploadInput, MediaView } from "@app/shared";

import { MEDIA_MAX_UPLOAD_BYTES, MediaUploadInputSchema } from "@app/shared";
import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { seconds, Throttle } from "@nestjs/throttler";

import type { AuthenticatedUser } from "../../auth/index.js";

import { HTTP_STATUS } from "../../../core/http-status.js";
import { ZodBodyPipe } from "../../../core/pipes/zod-body.pipe.js";
import { CurrentUser, JwtProtected } from "../../auth/index.js";
import { MediaService } from "../application/media.service.js";
import { MEDIA_ERROR_CODES, mediaError } from "../domain/media-error-code.js";
import { MediaViewDto } from "./view-dto/media.view-dto.js";

const UPLOAD_LIMIT = 20;
const UPLOAD_TTL_SECONDS = 60;

type UploadedImage = {
  buffer: Buffer;
  originalname: string;
  size: number;
};

@ApiTags("media")
@Controller("api/media")
@JwtProtected()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @ApiNoContentResponse({ description: "The media asset was deleted" })
  @ApiNotFoundResponse({ description: "Media not found" })
  @ApiOperation({ summary: "Delete a media asset of the current user" })
  @Delete(":id")
  @HttpCode(HTTP_STATUS.NO_CONTENT)
  delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.mediaService.delete({ id, userId: user.id });
  }

  @ApiBody({
    schema: {
      properties: {
        crop: {
          description:
            'JSON-encoded crop rectangle in oriented pixels, e.g. {"x":0,"y":0,"width":1200,"height":1600}',
          type: "string",
        },
        file: { format: "binary", type: "string" },
        kind: { enum: ["avatar", "book_cover", "series_cover"], type: "string" },
      },
      required: ["file"],
      type: "object",
    },
  })
  @ApiConsumes("multipart/form-data")
  @ApiCreatedResponse({ description: "The processed media asset", type: MediaViewDto })
  @ApiOperation({ summary: "Upload an image and get the processed media asset" })
  @HttpCode(HTTP_STATUS.CREATED)
  @Post()
  @Throttle({ default: { limit: UPLOAD_LIMIT, ttl: seconds(UPLOAD_TTL_SECONDS) } })
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MEDIA_MAX_UPLOAD_BYTES } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: undefined | UploadedImage,
    @Body(new ZodBodyPipe(MediaUploadInputSchema)) body: MediaUploadInput,
  ): Promise<MediaView> {
    if (file === undefined) {
      throw mediaError("File is required", MEDIA_ERROR_CODES.fileRequired);
    }
    return this.mediaService.upload({
      crop: body.crop,
      file: {
        buffer: file.buffer,
        originalName: file.originalname,
        size: file.size,
      },
      kind: body.kind,
      userId: user.id,
    });
  }
}

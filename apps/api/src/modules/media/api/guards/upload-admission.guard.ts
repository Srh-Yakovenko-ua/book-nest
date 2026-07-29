import type { Nullable } from "@app/shared";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Socket } from "node:net";

import { Injectable } from "@nestjs/common";

import { MEDIA_ADMISSION, MediaAdmission } from "../../infrastructure/media-admission.js";

@Injectable()
export class UploadAdmissionGuard implements CanActivate {
  constructor(private readonly mediaAdmission: MediaAdmission) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const releaseUploadSlot = await this.mediaAdmission.acquireUpload();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const socket: Nullable<Socket> = response.socket ?? request.socket;

    if (socket === null || socket.destroyed || response.writableEnded) {
      releaseUploadSlot();
      return true;
    }

    let holdDeadline: Nullable<NodeJS.Timeout> = null;
    const release = (): void => {
      if (holdDeadline !== null) {
        clearTimeout(holdDeadline);
        holdDeadline = null;
      }
      socket.off("close", release);
      releaseUploadSlot();
    };

    holdDeadline = setTimeout(() => {
      release();
      socket.destroy();
    }, MEDIA_ADMISSION.upload.holdDeadlineMs);
    holdDeadline.unref();

    socket.once("close", release);
    response.once("close", release);
    response.once("finish", release);
    return true;
  }
}

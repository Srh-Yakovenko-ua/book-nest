import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";

import bodyParser from "body-parser";
import { finalize, type Observable } from "rxjs";
import { z } from "zod";

import { BoundedSemaphore, type BoundedSemaphoreOptions } from "./bounded-semaphore.js";
import { BadRequestError, HttpError } from "./exceptions/errors.js";
import { HTTP_STATUS } from "./http-status.js";
import { exceedsJsonValueBudget } from "./json-value-budget.js";

const UTF8_CHARSET = "utf-8";

const BodyTooLargeErrorSchema = z.object({ type: z.literal("entity.too.large") });

export type DeferredJsonBodyOptions = {
  admission: BoundedSemaphoreOptions & { waitTimeoutMs: number };
  limits: {
    maxBytes: number;
    maxJsonObjectMembers: number;
    maxJsonValues: number;
    readDeadlineMs: number;
  };
  tooLargeCode: string;
};

type JsonBodyParser = ReturnType<typeof bodyParser.json>;

export class DeferredJsonBodyInterceptor implements NestInterceptor {
  private readonly admission: BoundedSemaphore;
  private readonly admissionWaitTimeoutMs: number;
  private readonly parseJsonBody: JsonBodyParser;
  private readonly readDeadlineMs: number;
  private readonly tooLargeCode: string;

  constructor({ admission, limits, tooLargeCode }: DeferredJsonBodyOptions) {
    this.admission = new BoundedSemaphore(admission);
    this.admissionWaitTimeoutMs = admission.waitTimeoutMs;
    this.readDeadlineMs = limits.readDeadlineMs;
    this.tooLargeCode = tooLargeCode;
    this.parseJsonBody = bodyParser.json({
      limit: limits.maxBytes,
      verify: (_request, _response, body, charset) => {
        if (charset !== UTF8_CHARSET) {
          throw new BadRequestError("The request body must be UTF-8 encoded JSON");
        }
        if (
          exceedsJsonValueBudget({
            body,
            maxObjectMembers: limits.maxJsonObjectMembers,
            maxValues: limits.maxJsonValues,
          })
        ) {
          throw this.tooLargeError();
        }
      },
    });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (request.readableEnded) {
      throw new Error(
        `The JSON body of ${request.method} ${request.path} was consumed before DeferredJsonBodyInterceptor; register the route as a deferred JSON route`,
      );
    }
    const releaseAdmission = await this.admission.acquire({
      timeoutMs: this.admissionWaitTimeoutMs,
    });
    try {
      await this.readJsonBody({ request, response });
    } catch (error) {
      releaseAdmission();
      throw error;
    }
    return next.handle().pipe(finalize(releaseAdmission));
  }

  private readJsonBody({
    request,
    response,
  }: {
    request: Request;
    response: Response;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      const readDeadline = setTimeout(() => {
        response.setHeader("Connection", "close");
        response.once("finish", () => request.destroy());
        reject(
          new HttpError(HTTP_STATUS.REQUEST_TIMEOUT, "The request body was not received in time"),
        );
      }, this.readDeadlineMs);
      readDeadline.unref();
      this.parseJsonBody(request, response, (error?: unknown) => {
        clearTimeout(readDeadline);
        if (error === undefined || error === null) {
          resolve();
          return;
        }
        reject(this.toReadError(error));
      });
    });
  }

  private tooLargeError(): HttpError {
    return new HttpError(
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      "The request body exceeds the allowed size",
      { code: this.tooLargeCode },
    );
  }

  private toReadError(error: unknown): Error {
    if (error instanceof HttpError) {
      return error;
    }
    if (BodyTooLargeErrorSchema.safeParse(error).success) {
      return this.tooLargeError();
    }
    return error instanceof Error ? error : new BadRequestError("The request body is unreadable");
  }
}

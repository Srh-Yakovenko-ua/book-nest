import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import type { StoredObject } from "../domain/storage.port.js";

import { env } from "../../../config/env.js";
import { BadGatewayError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { StoragePort } from "../domain/storage.port.js";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONNECTION_TIMEOUT_MS = 3_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

const logger = createLogger("media.s3-storage");

@Injectable()
export class S3StorageAdapter extends StoragePort {
  private readonly client = new S3Client({
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
    endpoint: env.r2Endpoint,
    forcePathStyle: env.r2ForcePathStyle,
    maxAttempts: MAX_ATTEMPTS,
    region: env.r2Region,
    requestHandler: {
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      requestTimeout: REQUEST_TIMEOUT_MS,
      throwOnRequestTimeout: true,
    },
  });

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: env.r2Bucket,
        Delete: { Objects: keys.map((key) => ({ Key: key })) },
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: env.r2Bucket, Key: key }));
    if (result.Body === undefined) {
      logger.error({ key }, "storage object has no body");
      throw new BadGatewayError("Storage object is unavailable");
    }
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  publicUrl(key: string): string {
    return `${env.r2PublicBaseUrl}/${key}`;
  }

  async put(object: StoredObject): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Body: object.body,
        Bucket: env.r2Bucket,
        CacheControl: IMMUTABLE_CACHE_CONTROL,
        ContentType: object.contentType,
        Key: object.key,
      }),
    );
  }
}

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";

import type { StoredObject } from "../domain/storage.port.js";

import { env } from "../../../config/env.js";
import { StoragePort } from "../domain/storage.port.js";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

@Injectable()
export class S3StorageAdapter extends StoragePort {
  private readonly client = new S3Client({
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
    endpoint: env.r2Endpoint,
    forcePathStyle: env.r2ForcePathStyle,
    region: env.r2Region,
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
      throw new Error(`Storage object has no body: ${key}`);
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

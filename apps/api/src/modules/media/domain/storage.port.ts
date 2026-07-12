export type StoredObject = {
  body: Buffer;
  contentType: string;
  key: string;
};

export abstract class StoragePort {
  abstract delete(keys: string[]): Promise<void>;
  abstract get(key: string): Promise<Buffer>;
  abstract publicUrl(key: string): string;
  abstract put(object: StoredObject): Promise<void>;
}

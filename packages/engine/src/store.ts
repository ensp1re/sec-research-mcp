import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

export interface StoredObject {
  hash: string;
  byteSize: number;
  mediaType: string;
  filePath: string;
}

export class ObjectStore {
  constructor(private readonly root: string) {}

  async put(bytes: Buffer, mediaType: string): Promise<StoredObject> {
    const hash = createHash("sha256").update(bytes).digest("hex");
    const dir = path.join(this.root, hash.slice(0, 2));
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, hash);
    await writeFile(filePath, bytes);
    return { hash, byteSize: bytes.byteLength, mediaType, filePath };
  }

  async get(hash: string): Promise<Buffer> {
    return readFile(path.join(this.root, hash.slice(0, 2), hash));
  }
}

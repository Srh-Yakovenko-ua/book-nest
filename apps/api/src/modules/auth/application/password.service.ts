import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const BCRYPT_COST = 12;

@Injectable()
export class PasswordService {
  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(this.digest(plain), hash);
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(this.digest(plain), BCRYPT_COST);
  }

  private digest(plain: string): string {
    return createHash("sha256").update(plain).digest("base64");
  }
}

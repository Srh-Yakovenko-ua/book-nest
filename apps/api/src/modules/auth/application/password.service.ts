import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

const BCRYPT_COST = 12;

@Injectable()
export class PasswordService {
  private readonly dummyHash = bcrypt.hashSync(this.digest("dummy-password"), BCRYPT_COST);

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(this.digest(plain), hash);
  }

  fakeCompare(plain: string): Promise<boolean> {
    return bcrypt.compare(this.digest(plain), this.dummyHash);
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(this.digest(plain), BCRYPT_COST);
  }

  private digest(plain: string): string {
    return createHash("sha256").update(plain).digest("base64");
  }
}

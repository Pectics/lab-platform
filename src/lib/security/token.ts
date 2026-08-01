import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type BearerTokenKind = "subscription" | "agent";

export interface IssuedBearerToken {
  secret: string;
  digest: string;
  prefix: string;
}

const kindPrefixes: Record<BearerTokenKind, string> = {
  subscription: "sub_live_",
  agent: "agt_live_",
};

export class BearerTokenService {
  private readonly pepper: Buffer;

  constructor(
    pepper: string,
    private readonly randomSource: (size: number) => Uint8Array = randomBytes,
  ) {
    this.pepper = Buffer.from(pepper);
    if (this.pepper.byteLength < 32) {
      throw new Error("TOKEN_HASH_PEPPER must contain at least 32 bytes");
    }
  }

  issue(kind: BearerTokenKind): IssuedBearerToken {
    const random = Buffer.from(this.randomSource(32));
    if (random.byteLength !== 32) {
      throw new Error("Token random source must return exactly 32 bytes");
    }

    const body = random.toString("base64url");
    const secret = `${kindPrefixes[kind]}${body}`;
    return {
      secret,
      digest: this.digest(secret),
      prefix: `${kindPrefixes[kind]}${body.slice(0, 8)}`,
    };
  }

  digest(secret: string): string {
    return createHmac("sha256", this.pepper).update(secret).digest("hex");
  }

  verify(kind: BearerTokenKind, candidate: string, expectedDigest: string): boolean {
    if (!candidate.startsWith(kindPrefixes[kind]) || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
      return false;
    }

    const actual = Buffer.from(this.digest(candidate), "hex");
    const expected = Buffer.from(expectedDigest, "hex");
    return timingSafeEqual(actual, expected);
  }
}

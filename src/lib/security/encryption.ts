import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface EncryptedSecret {
  ciphertext: string;
  nonce: string;
  keyVersion: number;
}

export interface SecretResource {
  type: string;
  id: string;
}

export class SecretEncryptionService {
  constructor(
    private readonly keys: ReadonlyMap<number, Uint8Array>,
    private readonly activeKeyVersion: number,
    private readonly randomSource: (size: number) => Uint8Array = randomBytes,
  ) {
    for (const [version, key] of keys) {
      if (!Number.isInteger(version) || version <= 0 || key.byteLength !== 32) {
        throw new Error("Encryption keys require a positive version and exactly 32 bytes");
      }
    }
    if (!keys.has(activeKeyVersion)) {
      throw new Error("Active encryption key version is unavailable");
    }
  }

  encrypt(resource: SecretResource, plaintext: string): EncryptedSecret {
    const nonce = Buffer.from(this.randomSource(12));
    if (nonce.byteLength !== 12) {
      throw new Error("Encryption random source must return exactly 12 bytes");
    }

    const key = this.requireKey(this.activeKeyVersion);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);
    cipher.setAAD(this.additionalData(resource));
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);

    return {
      ciphertext: ciphertext.toString("base64url"),
      nonce: nonce.toString("base64url"),
      keyVersion: this.activeKeyVersion,
    };
  }

  decrypt(resource: SecretResource, encrypted: EncryptedSecret): string {
    const key = this.requireKey(encrypted.keyVersion);
    const nonce = Buffer.from(encrypted.nonce, "base64url");
    const ciphertext = Buffer.from(encrypted.ciphertext, "base64url");

    if (nonce.byteLength !== 12 || ciphertext.byteLength < 16) {
      throw new Error("Encrypted secret has an invalid encoding");
    }

    const payload = ciphertext.subarray(0, -16);
    const tag = ciphertext.subarray(-16);
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAAD(this.additionalData(resource));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
  }

  private requireKey(version: number): Buffer {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Encryption key version ${version} is unavailable`);
    }
    return Buffer.from(key);
  }

  private additionalData(resource: SecretResource): Buffer {
    return Buffer.from(`${resource.type}\0${resource.id}`);
  }
}

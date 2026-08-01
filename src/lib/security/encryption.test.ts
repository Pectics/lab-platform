import { describe, expect, it } from "vitest";
import { SecretEncryptionService } from "./encryption";

const key1 = Buffer.alloc(32, 1);
const key2 = Buffer.alloc(32, 2);
const resource = { type: "endpoint_credential", id: "6a5308f0-775d-48ac-a456-b36e9758be1d" };

describe("SecretEncryptionService", () => {
  it("encrypts and decrypts with random nonces, versioned keys, and bound AAD", () => {
    let nonceByte = 0;
    const service = new SecretEncryptionService(new Map([[2, key2]]), 2, (size) =>
      new Uint8Array(size).fill(++nonceByte),
    );
    const first = service.encrypt(resource, "protocol-secret");
    const second = service.encrypt(resource, "protocol-secret");

    expect(first.keyVersion).toBe(2);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.ciphertext).not.toContain("protocol-secret");
    expect(service.decrypt(resource, first)).toBe("protocol-secret");
    expect(service.decrypt(resource, service.encrypt(resource, ""))).toBe("");
    expect(() => service.decrypt({ ...resource, id: "different-id" }, first)).toThrow();
    expect(() => service.decrypt({ ...resource, type: "different-type" }, first)).toThrow();
  });

  it("rejects tampering, unknown keys, and malformed encodings", () => {
    const service = new SecretEncryptionService(new Map([[1, key1]]), 1, (size) =>
      new Uint8Array(size).fill(9),
    );
    const encrypted = service.encrypt(resource, "secret");
    const tampered = Buffer.from(encrypted.ciphertext, "base64url");
    tampered[0] ^= 1;

    expect(() =>
      service.decrypt(resource, { ...encrypted, ciphertext: tampered.toString("base64url") }),
    ).toThrow();
    expect(() => service.decrypt(resource, { ...encrypted, keyVersion: 2 })).toThrowError(
      "Encryption key version 2 is unavailable",
    );
    expect(() => service.decrypt(resource, { ...encrypted, nonce: "AA" })).toThrowError(
      "Encrypted secret has an invalid encoding",
    );
    expect(() => service.decrypt(resource, { ...encrypted, ciphertext: "AA" })).toThrowError(
      "Encrypted secret has an invalid encoding",
    );
  });

  it("validates every key and entropy source", () => {
    expect(() => new SecretEncryptionService(new Map([[0, key1]]), 0)).toThrowError(
      "Encryption keys require a positive version and exactly 32 bytes",
    );
    expect(() => new SecretEncryptionService(new Map([[1, Buffer.alloc(31)]]), 1)).toThrowError(
      "Encryption keys require a positive version and exactly 32 bytes",
    );
    expect(() => new SecretEncryptionService(new Map([[1.5, key1]]), 1.5)).toThrowError(
      "Encryption keys require a positive version and exactly 32 bytes",
    );
    expect(() => new SecretEncryptionService(new Map([[1, key1]]), 2)).toThrowError(
      "Active encryption key version is unavailable",
    );
    expect(() =>
      new SecretEncryptionService(new Map([[1, key1]]), 1, () => new Uint8Array(11)).encrypt(
        resource,
        "secret",
      ),
    ).toThrowError("Encryption random source must return exactly 12 bytes");
  });
});

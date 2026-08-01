const REDACTED = "[REDACTED]";
const sensitiveKey = /authorization|token|secret|password|credential|ciphertext|nonce|config|url/i;
const bearerValue = /bearer\s+[^\s,;]+/gi;
const opaqueToken = /\b(?:sub|agt)_(?:live|test)_[A-Za-z0-9_-]+\b/g;

export function redactSensitive(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(bearerValue, `Bearer ${REDACTED}`).replace(opaqueToken, REDACTED);
  }

  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        sensitiveKey.test(key) ? REDACTED : redactSensitive(entry),
      ]),
    );
  }

  return value;
}

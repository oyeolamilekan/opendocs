import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCODING_VERSION = "v1";

/**
 * Encrypts an AI provider API key for storage.
 *
 * @param apiKey - Plaintext API key supplied by the user.
 * @returns Result produced by the function.
 */
export const encryptAiApiKey = (apiKey: string) => {
  const normalized = apiKey.trim();
  if (!normalized) {
    throw new Error("API key is required");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCODING_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
};

/**
 * Decrypts a stored AI provider API key value.
 *
 * @param encryptedValue - Versioned encrypted API key payload.
 * @returns Result produced by the function.
 */
export const decryptAiApiKey = (encryptedValue: string) => {
  const [version, ivValue, authTagValue, ciphertextValue] =
    encryptedValue.split(".");

  if (
    version !== ENCODING_VERSION ||
    !ivValue ||
    !authTagValue ||
    !ciphertextValue
  ) {
    throw new Error("Stored API key has an unsupported encryption format");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
};

/**
 * Creates a short redacted display hint for an API key.
 *
 * @param apiKey - Plaintext API key supplied by the user.
 * @returns Result produced by the function.
 */
export const createApiKeyHint = (apiKey: string) => {
  const normalized = apiKey.trim();
  if (normalized.length <= 4) return "••••";
  return `••••${normalized.slice(-4)}`;
};

/**
 * Loads and validates the server-side encryption key.
 *
 * @returns Validated encryption key bytes.
 */
const getEncryptionKey = () => {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AI_KEY_ENCRYPTION_SECRET must be configured with at least 16 characters",
    );
  }

  return createHash("sha256").update(secret).digest();
};

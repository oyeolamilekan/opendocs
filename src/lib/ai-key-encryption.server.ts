import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const ENCODING_VERSION = "v1";

export function encryptAiApiKey(apiKey: string) {
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
}

export function decryptAiApiKey(encryptedValue: string) {
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
}

export function createApiKeyHint(apiKey: string) {
  const normalized = apiKey.trim();
  if (normalized.length <= 4) return "••••";
  return `••••${normalized.slice(-4)}`;
}

function getEncryptionKey() {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AI_KEY_ENCRYPTION_SECRET must be configured with at least 16 characters",
    );
  }

  return createHash("sha256").update(secret).digest();
}

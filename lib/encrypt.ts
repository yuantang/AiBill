import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function keyBytes(keyHex = process.env.ENCRYPTION_KEY): Buffer {
  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("ENCRYPTION_KEY 必须是 32 字节的 hex（64 个字符）");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptSecret(plain: string, keyHex?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(keyHex), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(packed: string, keyHex?: string): string {
  const [ivHex, tagHex, dataHex] = packed.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("密文格式不对");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(keyHex), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}

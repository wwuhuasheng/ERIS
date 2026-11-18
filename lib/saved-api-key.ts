import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function encryptionKey(): Buffer {
  const encoded = process.env.ERIS_API_KEY_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("API Key 加密密钥未配置或格式错误。");
  return key;
}

export function encryptApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (key.length < 10 || key.length > 300) throw new Error("DeepSeek API Key 格式不正确。");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const encrypted = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptApiKey(value: string): string {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("保存的 API Key 格式无效。");
  const nonce = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("保存的 API Key 格式无效。");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}

function storageClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("账号密钥存储服务尚未配置。");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function savedApiKeyExists(ownerId: string): Promise<boolean> {
  const { data, error } = await storageClient().from("user_api_credentials").select("owner_id").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function saveApiKey(ownerId: string, apiKey: string): Promise<void> {
  const encrypted = encryptApiKey(apiKey);
  const { error } = await storageClient().from("user_api_credentials").upsert({
    owner_id: ownerId,
    encrypted_key: encrypted,
    updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (error) throw error;
}

export async function readSavedApiKey(ownerId: string): Promise<string | null> {
  const { data, error } = await storageClient().from("user_api_credentials").select("encrypted_key").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  try { return decryptApiKey(data.encrypted_key); }
  catch { throw new Error("API Key 解密失败，请检查服务端加密密钥。"); }
}

export async function removeSavedApiKey(ownerId: string): Promise<void> {
  const { error } = await storageClient().from("user_api_credentials").delete().eq("owner_id", ownerId);
  if (error) throw error;
}

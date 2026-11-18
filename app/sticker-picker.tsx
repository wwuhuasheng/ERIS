"use client";

import { useEffect, useRef, useState } from "react";
import { compactImage } from "@/lib/client-image";
import { authClient } from "@/lib/persistence";
import { cleanStickerTone, stickerContent, validCompactImage } from "@/lib/chat-media";

type SavedSticker = { image: string; tone: string };

export function StickerPicker({ ownerId, disabled, onSend }: { ownerId: string; disabled: boolean; onSend: (content: string) => void }) {
  const [stickers, setStickers] = useState<SavedSticker[]>([]);
  const stickersRef = useRef<SavedSticker[]>([]);
  const [recognizing, setRecognizing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const storageKey = `eris-stickers:${ownerId}`;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as unknown;
      const items = Array.isArray(saved) ? saved.flatMap((item): SavedSticker[] => {
        if (typeof item === "string" && validCompactImage(item)) return [{ image: item, tone: "" }];
        if (item && typeof item === "object" && "image" in item && typeof item.image === "string" && validCompactImage(item.image)) {
          return [{ image: item.image, tone: "tone" in item && typeof item.tone === "string" ? cleanStickerTone(item.tone) : "" }];
        }
        return [];
      }).slice(0, 12) : [];
      stickersRef.current = items;
      setStickers(items);
    } catch { stickersRef.current = []; setStickers([]); }
  }, [storageKey]);

  function persist(next: SavedSticker[]) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); stickersRef.current = next; setStickers(next); setError(""); return true; }
    catch { setError("浏览器空间不足，无法保存表情包。请删掉旧表情后重试。"); return false; }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      const image = await compactImage(file, 72);
      if (!validCompactImage(image)) throw new Error("表情包图片过大。");
      if (!persist([{ image, tone: "" }, ...stickersRef.current.filter((item) => item.image !== image)].slice(0, 12))) return;
      setRecognizing(image);
      const { data } = await authClient().auth.getSession();
      if (!data.session) throw new Error("请重新登录后识别语气。");
      const response = await fetch("/api/sticker-tone", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
        cache: "no-store",
      });
      const result = await response.json() as { tone?: string; error?: string };
      if (!response.ok || !result.tone) throw new Error(result.error || "语气识别失败。");
      persist(stickersRef.current.map((item) => item.image === image ? { ...item, tone: cleanStickerTone(result.tone!) } : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "表情包读取失败。"); }
    finally { setRecognizing(null); }
  }

  return <details className="sticker-picker"><summary>表情包</summary>
    <p className="muted">上传时会把压缩图片发给 DeepSeek Flash 识别语气；结果可修改。收藏保存在这台设备，发送后随对话保存。</p>
    <label className="field"><span>上传表情包</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>
    {recognizing && <small role="status">正在识别图片语气…</small>}
    <div className="sticker-grid">{stickers.map((item, index) => <div className="sticker-item" key={item.image}>
      <button type="button" disabled={disabled || recognizing === item.image} onClick={() => onSend(stickerContent(item.image, item.tone))} aria-label={`发送表情 ${index + 1}`}><img src={item.image} alt="" /></button>
      <input type="text" value={item.tone} maxLength={40} placeholder="填写语气" aria-label={`表情 ${index + 1} 的语气`} onChange={(event) => persist(stickersRef.current.map((current) => current.image === item.image ? { ...current, tone: cleanStickerTone(event.target.value) } : current))} />
      <button className="sticker-remove" type="button" onClick={() => persist(stickersRef.current.filter((current) => current.image !== item.image))} aria-label={`删除表情 ${index + 1}`}>×</button>
    </div>)}</div>
    {error && <small className="error" role="alert">{error}</small>}
  </details>;
}

"use client";

import { useState } from "react";
import { compactImage } from "@/lib/client-image";
import type { Scenario } from "@/lib/scenario";

export function AvatarEditor({ scenario, onChange }: { scenario: Scenario; onChange: (value: Scenario) => void }) {
  const [error, setError] = useState("");
  async function upload(file: File | undefined, key: "userAvatar" | "otherAvatar") {
    if (!file) return;
    try {
      const image = await compactImage(file, 96);
      onChange({ ...scenario, [key]: image });
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "头像读取失败。"); }
  }
  return <div className="avatar-editor"><h2>对话头像</h2><p className="muted">可选。上传的图片会压缩并随场景保存在你的账号里，分享场景文件时会清空。</p><div className="two-cols">{(["userAvatar", "otherAvatar"] as const).map((key) => <div className="avatar-upload" key={key}>{scenario[key] ? <img src={scenario[key]} alt="当前头像" /> : <span aria-hidden="true">{key === "userAvatar" ? "你" : "对方"}</span>}<label className="field"><span>{key === "userAvatar" ? "你的头像" : "对方头像"}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void upload(event.target.files?.[0], key)} /></label>{scenario[key] && <button className="text-button" type="button" onClick={() => onChange({ ...scenario, [key]: undefined })}>移除</button>}</div>)}</div>{error && <p className="error" role="alert">{error}</p>}</div>;
}

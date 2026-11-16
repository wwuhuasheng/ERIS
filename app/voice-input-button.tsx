"use client";

import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function VoiceInputButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<Recognition | null>(null);

  useEffect(() => {
    const browser = window as RecognitionWindow;
    setSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => { active.current?.abort(); active.current = null; };
  }, []);

  useEffect(() => {
    if (disabled && active.current) { active.current.abort(); active.current = null; setListening(false); }
  }, [disabled]);

  function toggle() {
    if (active.current) { active.current.stop(); return; }
    const browser = window as RecognitionWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onText(transcript);
    };
    recognition.onerror = (event) => setError(event.error === "not-allowed" ? "麦克风权限未开启，请在浏览器中允许。" : "语音识别失败，请改用键盘输入。");
    recognition.onend = () => { active.current = null; setListening(false); };
    try {
      recognition.start();
      active.current = recognition;
      setListening(true);
      setError("");
    } catch { setError("无法启动语音识别，请改用键盘输入。"); }
  }

  if (!supported) return null;
  return <span className="voice-control"><button type="button" className="voice-button" onClick={toggle} disabled={disabled} aria-pressed={listening}>{listening ? "停止录音" : "语音输入"}</button>{error && <small role="alert">{error}</small>}</span>;
}

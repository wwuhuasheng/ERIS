export const stickerPrefix = "ERIS_STICKER_V1:";
export const stickerTonePrefix = "ERIS_STICKER_V2:";
const imagePattern = /^data:image\/(?:webp|png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/;

export function validCompactImage(value: string, maxLength = 3000): boolean {
  return value.length <= maxLength && imagePattern.test(value);
}

export function cleanStickerTone(value: string): string {
  return value.trim().replace(/[\r\n\t]+/g, " ").slice(0, 40);
}

export function stickerContent(image: string, tone = ""): string {
  if (!validCompactImage(image)) throw new Error("表情包图片过大，请换一张更简单的图片。");
  const cleanTone = cleanStickerTone(tone);
  return cleanTone ? stickerTonePrefix + encodeURIComponent(cleanTone) + ":" + image : stickerPrefix + image;
}

export function stickerData(content: string): { image: string; tone: string } | null {
  if (content.startsWith(stickerPrefix)) {
    const image = content.slice(stickerPrefix.length);
    return validCompactImage(image) ? { image, tone: "" } : null;
  }
  if (!content.startsWith(stickerTonePrefix)) return null;
  const separator = content.indexOf(":", stickerTonePrefix.length);
  if (separator < 0) return null;
  try {
    const tone = decodeURIComponent(content.slice(stickerTonePrefix.length, separator));
    const image = content.slice(separator + 1);
    return tone && tone === cleanStickerTone(tone) && validCompactImage(image) ? { image, tone } : null;
  } catch { return null; }
}

export function stickerImage(content: string): string | null {
  return stickerData(content)?.image || null;
}

export function modelVisibleText(content: string): string {
  const sticker = stickerData(content);
  if (!sticker) return content;
  return sticker.tone
    ? `（用户发送了一张表情包；图片语气的机器推测是“${sticker.tone}”。请结合上下文自然回应，不要声称你看到了图片的具体内容。）`
    : "（用户发送了一张表情包。请根据对话回应，不要声称看到了图片的具体内容。）";
}

export function displayMessageText(content: string): string {
  const sticker = stickerData(content);
  return sticker ? sticker.tone ? `[发送了一张表情包，语气：${sticker.tone}]` : "[发送了一张表情包]" : content;
}

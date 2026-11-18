import { describe, expect, it } from "vitest";
import { displayMessageText, modelVisibleText, stickerContent, stickerData, stickerImage, validCompactImage } from "../lib/chat-media";

const image = "data:image/webp;base64,UklGRg==";

describe("compact chat images", () => {
  it("stores valid sticker data but sends only a description to the model", () => {
    const content = stickerContent(image);
    expect(stickerImage(content)).toBe(image);
    expect(modelVisibleText(content)).not.toContain("UklGRg");
    expect(modelVisibleText(content)).toContain("表情包");
    expect(displayMessageText(content)).toBe("[发送了一张表情包]");
  });
  it("rejects non-image and oversized data", () => {
    expect(validCompactImage("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(() => stickerContent(image + "a".repeat(4000))).toThrow("过大");
  });
  it("keeps recognized tone with the sticker without exposing image data to chat prompts", () => {
    const content = stickerContent(image, "有点委屈！！");
    expect(stickerData(content)).toEqual({ image, tone: "有点委屈！！" });
    expect(modelVisibleText(content)).toContain("有点委屈！！");
    expect(modelVisibleText(content)).not.toContain("UklGRg");
    expect(displayMessageText(content)).toContain("语气：有点委屈！！");
  });
});

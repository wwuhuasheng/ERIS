import { afterEach, describe, expect, it, vi } from "vitest";
import { recognizeStickerTone } from "../lib/sticker-tone";

afterEach(() => vi.unstubAllGlobals());

describe("sticker tone recognition", () => {
  it("sends only the uploaded compact image to DeepSeek Flash", async () => {
    const image = "data:image/webp;base64,UklGRg==";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: "有点委屈！！" }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await recognizeStickerTone(image, "private-key")).toBe("有点委屈！！");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.deepseek.com/responses");
    expect(options.headers.Authorization).toBe("Bearer private-key");
    const body = JSON.parse(options.body);
    expect(body.model).toBe("deepseek-flash");
    expect(body.input[0].content[1]).toEqual({ type: "input_image", image_url: image, detail: "low" });
  });

  it("rejects invalid images before a provider call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(recognizeStickerTone("data:text/plain;base64,QQ==", "private-key")).rejects.toThrow("invalid_sticker_input");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

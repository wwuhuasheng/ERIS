export async function compactImage(file: File, dimension: number, maxLength = 3000): Promise<string> {
  if (!/image\/(png|jpeg|webp)/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("请选择不超过 5 MB 的 PNG、JPEG 或 WebP 图片。");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    for (const target of [dimension, Math.round(dimension * 0.75), Math.round(dimension * 0.5)]) {
      const scale = Math.min(1, target / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("浏览器无法处理这张图片。");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.6, 0.4, 0.25]) {
        const data = canvas.toDataURL("image/webp", quality);
        if (data.startsWith("data:image/webp;") && data.length <= maxLength) return data;
      }
    }
    throw new Error("图片压缩后仍过大，请选择更简单的图片。");
  } finally { URL.revokeObjectURL(url); }
}

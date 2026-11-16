import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ERIS · 关系情境模拟",
    short_name: "ERIS",
    description: "给未说出口的话，一个可重来的空间。",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ef",
    theme_color: "#1e655d",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ERIS · 给未说出口的话一个空间",
  description: "与有立场的虚构角色练习困难对话。模拟不代表现实人物的真实想法。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

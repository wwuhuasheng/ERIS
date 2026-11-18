import type { Metadata } from "next";
import { ErisEntry } from "../eris-entry";

export const metadata: Metadata = {
  title: "创作者空间 · ERIS",
  description: "创建并保存属于自己的 ERIS 场景模板。",
};

export default function CreatorPage() {
  return <ErisEntry creatorEntry />;
}

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "简介 · ERIS",
  description: "ERIS 项目简介。",
};

export default function AboutPage() {
  return <main className="shell">
    <header className="site-header"><Link className="brand" href="/">✳ <span>ERIS</span></Link><span className="header-note">给未说出口的话，一个可重来的空间</span><span className="phase">简介</span></header>
    <section className="panel narrow about-panel">
      <div className="eyebrow">ABOUT ERIS</div>
      <h1>简介</h1>
      <div className="about-content">
        {/* 在这里替换为你自己写的简介正文。 */}
        <p className="muted">简介内容待填写。</p>
      </div>
      <Link className="text-button" href="/">← 返回首页</Link>
    </section>
    <footer>ERIS · 一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。</footer>
  </main>;
}

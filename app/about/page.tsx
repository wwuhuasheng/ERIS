import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "简介 · ERIS",
  description: "ERIS 项目简介。",
};

export default function AboutPage() {
  return (
    <main className="shell">
      <header className="site-header">
        <Link className="brand" href="/">
          ✳ <span>ERIS</span>
        </Link>
        <span className="header-note">给未说出口的话，一个可重来的空间</span>
        <span className="phase">简介</span>
      </header>
      <section className="panel narrow about-panel">
        <div className="eyebrow">ABOUT ERIS</div>
        <h1>简介</h1>
        <div className="about-content">
          {/* ERIS作为一个用来完成情绪交互、发泄、复盘的网页端应用。希望在使用的过程中，可以说出没来得及说出口的话，发泄积压在心底的情绪，辅助复盘当时的情景。虽然对话的是AI，但已经尽力还原真实口吻，说不定可以在于AI对话的过程中，找到一些头绪，解开一些心结。也正是因为AI希望大家可以无所顾虑的表达自己的情绪，然后回归现实生活，好好生活，好好工作，好好上班。最后祝大家用的开心*/}
        </div>
        <Link className="text-button" href="/">
          ← 返回首页
        </Link>
      </section>
      <footer>
        ERIS ·
        一种可能性，不是现实预测。若你或他人正处于危险，请联系当地紧急服务或可信任的人。
      </footer>
    </main>
  );
}

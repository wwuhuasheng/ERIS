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
        <Link className="brand" href="/" aria-label="返回 ERIS 首页" title="返回首页">
          <img className="brand-logo" src="/eris-logo.jpg" alt="" /><span>ERIS</span>
        </Link>
        <span className="header-note">给未说出口的话，一个可重来的空间</span>
        <span className="phase">简介</span>
      </header>
      <section className="panel narrow about-panel">
        <div className="eyebrow">ABOUT ERIS</div>
        <h1>简介</h1>
        <div className="about-content">
          <p>ERIS 是一个用来完成情绪交互、发泄与复盘的网页应用。希望你在使用过程中，能说出没来得及说出口的话，释放积压在心底的情绪，也能回看当时的情景。</p>
          <p>虽然对话的是 AI，我们仍尽力让角色用自然的口吻回应。也许在与 AI 对话的过程中，你会找到一些头绪，解开一些心结。</p>
          <p>也正因为对话的是 AI，希望大家可以少些顾虑地表达自己的情绪，然后回到现实生活，好好生活、好好工作。最后，祝大家用得开心。</p>
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

import Link from "next/link";
import { Activity, ArrowRight, Dumbbell, TimerReset } from "lucide-react";

const priorities = [
  { icon: Dumbbell, label: "Log without friction", detail: "Your session stays focused on the next set." },
  { icon: Activity, label: "See the signal", detail: "Training history turns effort into useful context." },
  { icon: TimerReset, label: "Keep your work", detail: "Workout drafts are designed to survive interruptions." },
];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Forge home">
          <span className="brand-mark">F</span><span>FORGE<span className="brand-period">.</span></span>
        </Link>
        <div className="landing-actions"><span className="topbar-note">TRAINING, MADE MEASURABLE</span><Link className="landing-signin" href="/login">Sign in <ArrowRight size={14} /></Link></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="live-dot" /> BUILT AROUND THE WORK</p>
          <h1>Show up.<br /><span>Track honestly.</span><br />Get stronger.</h1>
          <p className="hero-description">A training log should make your next session clearer. Forge is being built for fast logging, useful history, and progress you can explain.</p>
          <Link className="primary-link" href="/dashboard">Open your training space <ArrowRight size={17} /></Link>
          <p className="fine-print">FOUNDATION IN PROGRESS <span>·</span> YOUR TRAINING, YOUR DATA</p>
        </div>

        <aside className="session-card" aria-label="Product principles">
          <div className="card-topline"><span>THE TRAINING LOOP</span><span className="card-index">01 / 03</span></div>
          <div className="loop-graphic" aria-hidden="true">
            <div className="loop-orbit orbit-outer" /><div className="loop-orbit orbit-inner" />
            <span className="orbit-node node-one">01</span><span className="orbit-node node-two">02</span><span className="orbit-node node-three">03</span>
            <div className="loop-center"><span className="center-glyph">↗</span><span>PROGRESS<br />COMPOUNDS</span></div>
          </div>
          <div className="card-footer"><span>TRAIN</span><span className="footer-line" /><span>REVIEW</span><span className="footer-line" /><span>ADJUST</span></div>
        </aside>
      </section>

      <section className="principles" aria-label="Product principles">
        {priorities.map(({ icon: Icon, label, detail }, index) => (
          <article className="principle" key={label}>
            <span className="principle-number">0{index + 1}</span><Icon size={19} strokeWidth={1.7} />
            <div><h2>{label}</h2><p>{detail}</p></div>
          </article>
        ))}
      </section>
      <footer className="page-footer"><span>FORGE TRAINING SYSTEM</span><span>CONSISTENCY OVER COMPLEXITY</span></footer>
    </main>
  );
}

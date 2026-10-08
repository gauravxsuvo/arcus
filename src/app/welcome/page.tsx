import Link from "next/link";
import { ArrowRight, ArrowUpRight, BarChart3, Dumbbell, History } from "lucide-react";
import { ArcusMark } from "@/components/shared/arcus-mark";

const highlights = [
  { icon: Dumbbell, title: "Log with focus", description: "Weights, reps, effort and rest in one clear session." },
  { icon: BarChart3, title: "See your progress", description: "Follow your records, volume and consistency over time." },
  { icon: History, title: "Pick up where you left off", description: "Find past sessions and repeat a workout in a tap." },
];

export default function WelcomePage() {
  return <main className="welcome-page">
    <header className="welcome-header">
      <Link href="/dashboard" className="welcome-brand" aria-label="Open ARCUS Home"><ArcusMark size={29}/><span>ARCUS.</span></Link>
      <nav aria-label="Account"><Link className="welcome-signin" href="/login">Sign in</Link><Link className="welcome-signup" href="/signup">Sign up <ArrowUpRight size={15} aria-hidden="true"/></Link></nav>
    </header>

    <div className="welcome-content">
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <div className="welcome-intro">
          <p className="welcome-kicker"><span className="social-live-dot"/> YOUR TRAINING SPACE</p>
          <h1 id="welcome-title">Show up.<br/><span>Get stronger.</span></h1>
          <p className="welcome-description">A focused home for your training. Log the work, see how far you have come, and walk into the next session knowing what to do.</p>
          <div className="welcome-actions"><Link className="welcome-primary" href="/dashboard"><Dumbbell size={19} aria-hidden="true"/> Open ARCUS <ArrowRight size={18} aria-hidden="true"/></Link><Link className="welcome-secondary" href="/signup">Create an account</Link></div>
          <p className="welcome-footnote">START WITH A SESSION. BUILD FROM THERE.</p>
        </div>
        <div className="welcome-preview" aria-label="How ARCUS works">
          <p className="welcome-preview-label"><span className="social-live-dot"/> TODAY’S TRAINING</p>
          <h2>Make the next set count.</h2>
          <p>Everything you need to train with a little more clarity.</p>
          <div className="welcome-preview-steps">
            <div><span>01</span><strong>Log the work</strong><Dumbbell size={19} aria-hidden="true"/></div>
            <div><span>02</span><strong>See what changed</strong><BarChart3 size={19} aria-hidden="true"/></div>
            <div><span>03</span><strong>Return stronger</strong><History size={19} aria-hidden="true"/></div>
          </div>
          <Link href="/workout">Start a workout <ArrowRight size={17} aria-hidden="true"/></Link>
        </div>
      </section>

      <section className="welcome-highlights" aria-label="What you can do in ARCUS">{highlights.map(({icon:Icon,title,description})=><article key={title}><span className="welcome-highlight-icon"><Icon size={20} aria-hidden="true"/></span><h2>{title}</h2><p>{description}</p></article>)}</section>
      <section className="welcome-bottom"><div><p className="welcome-kicker">YOUR NEXT SESSION</p><h2>Ready when you are.</h2><p>Start logging, or explore the exercise library first.</p></div><div><Link href="/dashboard">Open your training space <ArrowRight size={17} aria-hidden="true"/></Link><Link href="/exercises">Browse exercises</Link></div></section>
    </div>
    <footer className="welcome-footer"><span>ARCUS TRAINING</span><span>CONSISTENCY OVER COMPLEXITY</span></footer>
  </main>;
}

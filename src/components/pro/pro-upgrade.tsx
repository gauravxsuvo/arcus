"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import styles from "./pro-upgrade.module.css";

type Plan = "monthly" | "yearly";
const plans: { id: Plan; name: string; price: string; cadence: string; detail: string; badge?: string }[] = [
  { id: "monthly", name: "Monthly", price: "₹199", cadence: "/ month", detail: "Billed monthly" },
  { id: "yearly", name: "Yearly", price: "₹1,500", cadence: "/ year", detail: "₹125 per month, billed yearly", badge: "SAVE 37%" },
];

const comparison: { feature: string; free: string; pro: string }[] = [
  { feature: "Workout logging", free: "Basic tracking", pro: "Unlimited workouts" },
  { feature: "Routines", free: "Up to 4", pro: "Unlimited" },
  { feature: "Custom exercises", free: "Up to 7", pro: "Unlimited" },
  { feature: "Tracking", free: "Basic", pro: "Advanced graph history" },
  { feature: "Rest timers", free: "—", pro: "Included" },
  { feature: "Profile badge", free: "—", pro: "ARCUS Pro badge" },
];

const faqs = [
  { question: "What does Pro include?", answer: "Pro is planned to include unlimited routines and custom exercises, unlimited workout logging, advanced graph history, rest timers, and an ARCUS Pro profile badge." },
  { question: "Can I cancel anytime?", answer: "Yes. Once billing is connected, you will be able to cancel from your account settings. Access would continue until the end of the paid period." },
  { question: "Does it auto-renew?", answer: "The selected plan is intended to renew at the end of each billing period until canceled. Checkout and recurring billing are not connected yet, so this page will not charge or renew anything." },
];

export function ProUpgrade() {
  const [selectedPlan, setSelectedPlan] = useState<Plan>("yearly");
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const selected = plans.find((plan) => plan.id === selectedPlan)!;

  async function previewSubscribe() {
    if (loading) return;
    setLoading(true);
    setShowPreview(false);
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    setLoading(false);
    setShowPreview(true);
  }

  return <main className={`${styles.page} social-shell`}>
    <section className={styles.hero}>
      <p className={styles.eyebrow}><span className={styles.liveDot}/> ARCUS MEMBERSHIP</p>
      <h1>Unlock <span>ARCUS Pro.</span></h1>
      <p className={styles.heroText}>More room to train, a longer view of your progress, and fewer limits between you and the next session.</p>
      <div className={styles.heroActions}><a className={styles.heroPrimary} href="#plans">Choose your plan <ArrowRight size={17}/></a><Link className={styles.heroSecondary} href="/home">Back to Home</Link></div>
      <ul className={styles.benefits}><li><Check size={15}/> Unlimited routines</li><li><Check size={15}/> Deeper progress history</li><li><Check size={15}/> Rest timer tools</li></ul>
    </section>

    <section className={styles.section} aria-labelledby="comparison-title">
      <div className={styles.sectionHead}><div><h2 id="comparison-title">A better training toolkit.</h2><p>Start with the essentials, then unlock more space and history with Pro.</p></div></div>
      <div className={styles.compareWrap}><table className={styles.compare}><thead><tr><th scope="col">Included</th><th scope="col">Free</th><th scope="col">ARCUS Pro</th></tr></thead><tbody>
        {comparison.map((row) => <tr key={row.feature}><td>{row.feature}</td><td>{row.free === "—" ? <span className={styles.featureExcluded}><X size={15} aria-label="Not included"/></span> : row.free}</td><td><span className={styles.featureIncluded}><Check size={15}/>{row.pro}</span></td></tr>)}
      </tbody></table></div>
    </section>

    <section className={styles.section} id="plans" aria-labelledby="plan-title">
      <div className={styles.sectionHead}><div><h2 id="plan-title">Choose how you train.</h2><p>Yearly is the best value. Pick the plan that fits your rhythm.</p></div></div>
      <div className={styles.planGrid} role="group" aria-label="Subscription billing plan">
        {plans.map((plan) => <motion.button className={styles.plan} key={plan.id} type="button" aria-pressed={selectedPlan === plan.id} onClick={() => { setSelectedPlan(plan.id); setShowPreview(false); }} whileTap={{ scale: .985 }}>
          {plan.badge && <span className={styles.planBadge}>{plan.badge}</span>}
          <span className={styles.planName}>{plan.name} plan</span>
          <span className={styles.planPrice}><strong>{plan.price}</strong><span>{plan.cadence}</span></span>
          <span className={styles.planSubtext}>{plan.detail}</span>
          {selectedPlan === plan.id && <motion.span className={styles.planSelection} layoutId="arcus-pro-plan-selection" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
        </motion.button>)}
      </div>
      <div className={styles.desktopCta}><div className={styles.ctaCopy}><strong>Selected: {selected.name} plan · {selected.price}{selected.cadence}</strong><span>No payment details needed for this preview.</span></div><button className={styles.subscribeButton} type="button" onClick={() => void previewSubscribe()} disabled={loading}>{loading ? <><LoaderCircle size={17} className={styles.spinner}/> Opening preview…</> : <>Subscribe to {selected.name} <ArrowRight size={17}/></>}</button></div>
      <AnimatePresence>{showPreview && <motion.div className={styles.notice} role="status" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}><strong>Checkout preview complete.</strong> Payments are not connected yet. No charge was made and Pro has not been activated.</motion.div>}</AnimatePresence>
    </section>

    <section className={styles.section} aria-labelledby="faq-title">
      <div className={styles.sectionHead}><div><h2 id="faq-title">A few useful answers.</h2><p>What to know before choosing a plan.</p></div></div>
      <div className={styles.faqList}>{faqs.map((faq) => <details className={styles.faq} key={faq.question}><summary><span>{faq.question}</span><ChevronDown size={17}/></summary><p>{faq.answer}</p></details>)}</div>
    </section>
    <p className={styles.finePrint}>ARCUS Pro plans are a product preview. Secure checkout, subscription management, and paid access will be enabled after billing integration.</p>
    <div className={styles.mobileCta}>
      <div className={styles.ctaCopy}><strong>{selected.name} · {selected.price}{selected.cadence}</strong><span>{selected.id === "yearly" ? "Save 37% with annual billing" : "Billed monthly"}</span></div>
      <button className={styles.subscribeButton} type="button" onClick={() => void previewSubscribe()} disabled={loading}>{loading ? <><LoaderCircle size={16} className={styles.spinner}/> Loading</> : <>Subscribe {selected.name} <ArrowRight size={15}/></>}</button>
      <AnimatePresence>{showPreview && <motion.div className={styles.notice} role="status" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}><strong>Preview complete.</strong> No charge was made; billing is not connected and Pro is not active.</motion.div>}</AnimatePresence>
    </div>
  </main>;
}

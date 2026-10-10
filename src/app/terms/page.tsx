import Link from "next/link";
import { pageMetadata } from "@/lib/site-metadata";
import styles from "../legal.module.css";

const contactEmail = process.env.PUBLIC_CONTACT_EMAIL?.trim() || "buildarcus@gmail.com";
const governingLaw = process.env.LEGAL_GOVERNING_LAW?.trim() || "India";

export const metadata = pageMetadata("Terms of Service | ARCUS", "Read the ARCUS account, acceptable-use, service availability, and fitness safety terms.", true);

export default function TermsOfServicePage() {
  return <main className={styles.page}>
    <p className={styles.eyebrow}>ARCUS · TERMS</p>
    <h1>Terms of Service</h1>
    <p className={styles.updated}>Last updated October 10, 2026</p>
    <p className={styles.intro}>These terms cover access to ARCUS, a training log for recording workouts and reviewing progress. By using ARCUS, you agree to use it responsibly and follow these terms.</p>

    <div className={styles.content}>
      <section><h2>Using ARCUS</h2><p>You must provide accurate account information, protect your sign-in credentials, and be legally able to use the service where you live. You are responsible for activity under your account. Do not misuse the service, interfere with its operation, attempt unauthorized access, or use it to upload unlawful or harmful content.</p></section>
      <section><h2>Your training data</h2><p>You retain your rights to the workout records and profile content you submit. You give ARCUS permission to store, process, back up, and sync that content only as needed to provide and secure the service. You are responsible for keeping your own exports or backups of important training data.</p></section>
      <section><h2>Medical and fitness disclaimer</h2><div className={styles.notice}><strong>ARCUS does not provide medical advice, diagnosis, treatment, or individualized coaching. The app’s exercise information, calculations, progress charts, and AI summaries are general informational tools and may be incomplete or inaccurate. Consult a qualified healthcare professional before beginning or changing an exercise program, especially if you have a medical condition, injury, or concern. You choose whether and how to train and do so at your own risk. Use appropriate equipment and technique, stop if you feel pain or become unwell, and seek medical help when needed. To the maximum extent permitted by applicable law, ARCUS and its owner are not responsible for injury or loss arising from training decisions or reliance on app content.</strong></div></section>
      <section><h2>Availability and changes</h2><p>ARCUS is provided as available. Offline use depends on your device and browser; syncing depends on connectivity and service providers. We may change, suspend, or discontinue features, and we may restrict or end access for misuse or security reasons. We will make reasonable efforts to preserve account data, but you should export records you want to keep.</p></section>
      <section><h2>Third-party services</h2><p>Hosting, database sync, analytics, and optional AI summaries may rely on third-party services described in the <Link href="/privacy">Privacy Policy</Link>. Those providers may have their own terms and privacy policies.</p></section>
      <section><h2>Disclaimers and limits</h2><p>Except where applicable law requires otherwise, ARCUS is offered without warranties that it will be uninterrupted, error-free, or suitable for a particular purpose. Nothing in these terms limits rights or remedies that cannot lawfully be limited. Any limitation of responsibility applies only to the maximum extent permitted by the law governing your use.</p></section>
      <section><h2>Governing law</h2><p>These terms are intended to be governed by the laws of <strong>{governingLaw}</strong>, without overriding mandatory consumer protections that apply where you live.</p></section>
      <section><h2>Contact</h2><p>Questions about these terms can be sent to <a className={styles.contact} href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></section>
    </div>
    <p className={styles.updated}><Link href="/privacy">Read the Privacy Policy →</Link></p>
  </main>;
}

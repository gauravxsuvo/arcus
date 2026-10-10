import Link from "next/link";
import { CookiePreferencesButton } from "@/components/shared/cookie-consent";
import { pageMetadata } from "@/lib/site-metadata";
import styles from "../legal.module.css";

const contactEmail = process.env.PUBLIC_CONTACT_EMAIL?.trim() || "buildarcus@gmail.com";

export const metadata = pageMetadata("Privacy Policy | ARCUS", "Learn what ARCUS stores, how workout and account data are used, which service providers process it, and how to request access or deletion.", true);

export default function PrivacyPolicyPage() {
  return <main className={styles.page}>
    <p className={styles.eyebrow}>ARCUS · PRIVACY</p>
    <h1>Privacy Policy</h1>
    <p className={styles.updated}>Last updated October 10, 2026</p>
    <p className={styles.intro}>Your training history belongs to you. This policy explains what ARCUS handles, where it is stored, and how to make a privacy request.</p>

    <div className={styles.content}>
      <section><h2>Information ARCUS stores</h2><p>When you create an account, ARCUS stores your email address, username, display name, password hash, profile details, and sign-in session data. If you provide them, profile details can include a bio, profile photo, height, experience, goals, and preferences. Workout records can include session dates and duration, exercises, sets, weights, reps, RPE/RIR, notes, program details, and body measurements.</p></section>
      <section><h2>Where it is stored</h2><p>ARCUS keeps workout and training data in browser storage on the device where you use the app so logging can work offline. If you use a signed-in account and sync is available, account, profile, and synced workout records are sent to a hosted PostgreSQL database through Portways. Some legacy sync paths can use Supabase when the Portways sync endpoint does not accept the session. ARCUS also stores essential sign-in session cookies and device preferences such as your theme.</p></section>
      <section><h2>How information is used</h2><p>ARCUS uses this information to sign you in, save your profile and workouts, sync records between devices, calculate training summaries and progress, and keep the service secure. Workout data is not used for advertising.</p></section>
      <section><h2>Optional AI workout summaries</h2><p>If you ask ARCUS to generate an AI workout summary, the current workout and a limited sample of recent workout history are sent to Google’s Gemini API to produce that summary. This feature is optional; the request is made only when you use it. Google processes that request under its own terms and privacy practices. Do not include sensitive personal information in workout notes you choose to send for a summary.</p></section>
      <section><h2>Optional traffic analytics</h2><p>If you choose Accept in the analytics prompt, ARCUS loads Vercel Web Analytics to measure page traffic. ARCUS limits tracking to known, non-record-specific routes and removes query strings before sending page-view URLs. Vercel says Web Analytics uses aggregated measurements and does not use third-party cookies; its visitor identifier is derived from a request hash and its session is discarded after 24 hours. Analytics stays disabled when you choose Decline. You can change your choice below.</p></section>
      <section><h2>Service providers</h2><p>ARCUS relies on providers to host the website and database, deliver optional analytics, and process optional AI summaries. These providers receive information only as needed to provide those services. ARCUS does not sell personal information.</p></section>
      <section><h2>Retention and deletion</h2><p>Local records remain in your browser until you remove them or clear ARCUS site data. Synced records are retained while the account is active. You may request access, correction, or deletion of your account and associated cloud data by contacting the address below. A deletion request will be reviewed and completed within a reasonable period, subject to applicable recordkeeping requirements. Signing out removes the current browser session; it does not by itself delete account or workout data.</p></section>
      <section><h2>Your choices and security</h2><p>You can decline analytics, use local logging without an account, export your training data from Profile → Data, or clear local site data in your browser. ARCUS uses password hashing, secure session handling, and access controls, but no internet service can guarantee absolute security. Contact ARCUS promptly if you believe your account has been accessed without permission.</p></section>
      <section className={styles.preferencesSection}><h2>Cookie and analytics preferences</h2><p>Essential session cookies support account sign-in. Analytics is optional and controlled separately.</p><CookiePreferencesButton/></section>
      <section><h2>Children and policy updates</h2><p>ARCUS is intended for people who can legally create an account in their location and is not designed for children. We may update this policy as the product changes; the date above identifies the latest version.</p></section>
      <section><h2>Contact</h2><p>For privacy requests or questions, contact <a className={styles.contact} href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p></section>
    </div>
    <p className={styles.updated}><Link href="/terms">Read the Terms of Service →</Link></p>
  </main>;
}

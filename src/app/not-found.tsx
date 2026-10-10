"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArcusMark } from "@/components/shared/arcus-mark";
import styles from "./not-found.module.css";

export default function NotFound() {
  return <main className={styles.page}>
    <div className={styles.starfield} aria-hidden="true">
      <span id="stars" className={styles.starsSmall}/>
      <span id="stars2" className={styles.starsMedium}/>
      <span id="stars3" className={styles.starsLarge}/>
      <span className={styles.glow}/>
    </div>

    <section className={styles.card} aria-labelledby="not-found-title">
      <Link className={styles.brand} href="/dashboard" aria-label="ARCUS home">
        <ArcusMark size={30}/><span>ARCUS<span className={styles.brandPeriod}>.</span></span>
      </Link>

      <div className={styles.divider} aria-hidden="true"><span/></div>
      <p className={styles.eyebrow}><span className={styles.statusDot}/> LOST IN THE TRAINING SPACE</p>
      <h1 id="not-found-title" aria-label="404 - You've drifted off course.">
        <span className={styles.code} aria-hidden="true">404</span>
        <span className={styles.title} aria-hidden="true">You&apos;ve drifted<br className={styles.desktopBreak}/> off course.</span>
      </h1>
      <p className={styles.description}>This page isn&apos;t on the map. Your training space is still right where you left it.</p>

      <Link className={styles.returnLink} href="/dashboard">
        <span>Return to Gym</span><ArrowRight size={18} aria-hidden="true"/>
      </Link>

      <p className={styles.footer}>ARCUS <span>·</span> TRAIN WITH INTENTION</p>
    </section>
  </main>;
}

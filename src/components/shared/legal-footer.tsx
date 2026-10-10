import Link from "next/link";
import styles from "./legal-footer.module.css";

export function LegalFooter({ year, tagline }: { year: number; tagline?: string }) {
  return <footer className={`${styles.footer} ${tagline ? styles.welcomeFooter : ""}`}>
    <span>© {year} ARCUS Training</span>
    {tagline && <span className={styles.tagline}>{tagline}</span>}
    <nav aria-label="Legal information">
      <Link href="/privacy">Privacy</Link>
      <Link href="/terms">Terms</Link>
    </nav>
  </footer>;
}

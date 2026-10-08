import Link from "next/link";
import { ArrowRight, BookOpen, Dumbbell, History, RotateCcw, Upload } from "lucide-react";
import type { WorkoutRecord } from "@/features/workouts/model";
import styles from "./overview.module.css";

type QuickStartProps = {
  active: WorkoutRecord | null;
  lastCompleted: WorkoutRecord | null;
  ready: boolean;
};

const shortcuts = [
  { href: "/programs", name: "Programs", description: "Plan your training", icon: BookOpen },
  { href: "/exercises", name: "Exercises", description: "Find a movement", icon: Dumbbell },
  { href: "/history", name: "History", description: "Past workouts", icon: History },
  { href: "/profile/data", name: "Import data", description: "Bring your history", icon: Upload },
];

export function QuickStart({ active, lastCompleted, ready }: QuickStartProps) {
  return <section className={styles.tools} aria-labelledby="home-tools-heading">
    <h2 id="home-tools-heading">Training tools</h2>
    <nav className={styles.shortcutGrid} aria-label="Training shortcuts">
      {shortcuts.map(({ href, name, description, icon: Icon }) => <Link className={styles.shortcut} href={href} key={href}>
        <Icon size={21} aria-hidden="true" /><span><strong>{name}</strong><small>{description}</small></span><ArrowRight className={styles.shortcutArrow} size={15} aria-hidden="true" />
      </Link>)}
    </nav>
    {ready && !active && lastCompleted && <Link className={styles.repeatLink} href={`/workout?repeat=${encodeURIComponent(lastCompleted.id)}`}>
      <RotateCcw size={18} aria-hidden="true" /><span><strong>Repeat last workout</strong><small>{lastCompleted.name || "Workout"}</small></span><ArrowRight size={16} aria-hidden="true" />
    </Link>}
  </section>;
}

import { useState, type ReactNode } from 'react';
import styles from './ConfirmButton.module.css';

interface Props {
  children: ReactNode;
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  ariaLabel?: string;
}

/** Two-step button: asks inline instead of relying on window.confirm (blocked in sandboxed frames). */
export function ConfirmButton({ children, question, confirmLabel, onConfirm, className, ariaLabel }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button className={className} onClick={() => setAsking(true)} aria-label={ariaLabel}>
        {children}
      </button>
    );
  }
  return (
    <span className={styles.ask} role="group" aria-label={question}>
      <span>{question}</span>
      <button className={styles.yes} onClick={() => { setAsking(false); onConfirm(); }}>
        {confirmLabel}
      </button>
      <button className={styles.no} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  );
}

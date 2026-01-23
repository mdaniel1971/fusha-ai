'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

const LEARNING_MODES = [
  {
    id: 'diagnostic_chat',
    title: 'Diagnostic Chat',
    description: 'Interactive conversation with Claude to learn Quranic vocabulary and grammar. Get personalized feedback and track your progress.',
    icon: '💬',
    href: '/diagnostic_chat',
  },
];

export default function LearnPage() {
  const router = useRouter();

  return (
    <main style={styles.container}>
      <button onClick={() => router.push('/')} style={styles.backButton}>
        ← Change Model
      </button>

      <h1 style={styles.title}>Choose Your Learning Mode</h1>
      <p style={styles.subtitle}>Select how you want to learn today</p>

      <div style={styles.modeGrid}>
        {LEARNING_MODES.map((mode) => (
          <Link key={mode.id} href={mode.href} style={styles.modeCard}>
            <div style={styles.modeIcon}>{mode.icon}</div>
            <div style={styles.modeTitle}>{mode.title}</div>
            <div style={styles.modeDescription}>{mode.description}</div>
          </Link>
        ))}
      </div>

      <div style={styles.footer}>
        <Link href="/progress" style={styles.progressLink}>
          View Your Progress →
        </Link>
      </div>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '2rem 1.5rem',
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
  },
  backButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    color: '#374151',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '0.5rem',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    textAlign: 'center',
    marginBottom: '2.5rem',
  },
  modeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  modeCard: {
    display: 'block',
    padding: '2rem',
    backgroundColor: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '16px',
    textDecoration: 'none',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  modeIcon: {
    fontSize: '2.5rem',
    marginBottom: '1rem',
  },
  modeTitle: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '0.5rem',
  },
  modeDescription: {
    fontSize: '0.95rem',
    color: '#666',
    lineHeight: '1.5',
  },
  footer: {
    marginTop: '3rem',
    textAlign: 'center',
  },
  progressLink: {
    fontSize: '0.95rem',
    color: '#3b82f6',
    textDecoration: 'none',
  },
};

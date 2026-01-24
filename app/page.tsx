'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  return (
    <main style={styles.container}>
      <div style={styles.hero}>
        <h1 style={styles.title}>FushaAI</h1>
        <p style={styles.subtitle}>Learn Quranic Arabic through conversation</p>
        <p style={styles.description}>
          An adaptive diagnostic tool that assesses your Arabic knowledge and
          adjusts difficulty based on your responses. Track your progress over time.
        </p>
      </div>

      <button
        onClick={() => router.push('/diagnostic_chat')}
        style={styles.startButton}
      >
        Start Diagnostic
      </button>

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
    maxWidth: '600px',
    margin: '0 auto',
    padding: '4rem 1.5rem',
    fontFamily: 'Arial, sans-serif',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '3rem',
  },
  title: {
    fontSize: '3rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: '1.25rem',
    color: '#666',
    marginBottom: '1.5rem',
  },
  description: {
    fontSize: '1rem',
    color: '#888',
    lineHeight: 1.6,
    maxWidth: '450px',
    margin: '0 auto',
  },
  startButton: {
    width: '100%',
    padding: '1.25rem',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  footer: {
    marginTop: '2rem',
    textAlign: 'center',
  },
  progressLink: {
    fontSize: '0.95rem',
    color: '#3b82f6',
    textDecoration: 'none',
  },
};

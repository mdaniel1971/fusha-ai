import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '4rem 1rem',
      textAlign: 'center' 
    }}>
      <h1 style={{ marginBottom: '1rem' }}>FushaAI</h1>
      <p style={{ marginBottom: '2rem', color: '#666' }}>
        Learn Quranic Arabic through conversation
      </p>
      
      <Link 
        href="/lesson"
        style={{
          display: 'inline-block',
          padding: '1rem 2rem',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '8px',
        }}
      >
        Start Lesson
      </Link>
    </main>
  );
}

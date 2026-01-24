export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'Arial, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: '#1a1a1a' }}>
        404
      </h1>
      <p style={{ fontSize: '1.25rem', color: '#666', marginBottom: '2rem' }}>
        Page not found
      </p>
      <a
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#1a1a1a',
          color: '#fff',
          borderRadius: '8px',
          textDecoration: 'none',
          fontSize: '1rem',
        }}
      >
        Go Home
      </a>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: 'Fast and cost-effective',
    speed: 'Fastest',
    cost: '$',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced performance',
    speed: 'Fast',
    cost: '$$',
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most capable',
    speed: 'Slower',
    cost: '$$$',
  },
];

export default function Home() {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);

  const handleContinue = () => {
    // Store selected model in sessionStorage for use by other pages
    sessionStorage.setItem('selectedModel', selectedModel);
    router.push('/learn');
  };

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>FushaAI</h1>
      <p style={styles.subtitle}>Learn Quranic Arabic through conversation</p>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Choose Your Model</h2>
        <p style={styles.sectionDescription}>
          Select which Claude model to use for your learning session
        </p>

        <div style={styles.modelGrid}>
          {MODELS.map((model) => (
            <div
              key={model.id}
              onClick={() => setSelectedModel(model.id)}
              style={{
                ...styles.modelCard,
                ...(selectedModel === model.id ? styles.modelCardSelected : {}),
              }}
            >
              <div style={styles.modelName}>{model.name}</div>
              <div style={styles.modelDescription}>{model.description}</div>
              <div style={styles.modelMeta}>
                <span style={styles.modelSpeed}>{model.speed}</span>
                <span style={styles.modelCost}>{model.cost}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleContinue} style={styles.continueButton}>
        Continue
      </button>
    </main>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '3rem 1.5rem',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '0.5rem',
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#666',
    textAlign: 'center',
    marginBottom: '3rem',
  },
  section: {
    marginBottom: '2rem',
  },
  sectionTitle: {
    fontSize: '1.3rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '0.5rem',
    textAlign: 'center',
  },
  sectionDescription: {
    fontSize: '0.95rem',
    color: '#666',
    textAlign: 'center',
    marginBottom: '1.5rem',
  },
  modelGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  modelCard: {
    padding: '1.25rem',
    backgroundColor: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modelCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  modelName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '0.25rem',
  },
  modelDescription: {
    fontSize: '0.9rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  modelMeta: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.85rem',
  },
  modelSpeed: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  modelCost: {
    color: '#22c55e',
    fontWeight: '500',
  },
  continueButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '1rem',
  },
};

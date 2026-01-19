'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface ExerciseTemplate {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
  sentence_count: number;
}

export default function LessonsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ExerciseTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_templates')
        .select('id, title, description, difficulty_level, sentence_count')
        .order('difficulty_level', { ascending: true });

      if (error) throw error;

      setTemplates(data || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load exercise templates');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return '#22c55e';
      case 'intermediate':
        return '#f59e0b';
      case 'advanced':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getDifficultyLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Choose Your Practice</h1>
        </div>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>Loading exercises...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Choose Your Practice</h1>
        </div>
        <div style={styles.errorContainer}>
          <div style={styles.errorText}>{error}</div>
          <button onClick={fetchTemplates} style={styles.retryButton}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          onClick={() => router.push('/lesson')}
          style={styles.backButton}
        >
          ← Back to Lesson
        </button>
        <h1 style={styles.title}>Choose Your Practice</h1>
        <p style={styles.subtitle}>
          Select an exercise to practice Quranic vocabulary with structured translation tasks
        </p>
      </div>

      <div style={styles.templatesGrid}>
        {templates.map((template) => (
          <div
            key={template.id}
            style={styles.templateCard}
            onClick={() => router.push(`/lessons/${template.id}`)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={styles.cardHeader}>
              <h2 style={styles.cardTitle}>{template.title}</h2>
              <span
                style={{
                  ...styles.difficultyBadge,
                  backgroundColor: getDifficultyColor(template.difficulty_level),
                }}
              >
                {getDifficultyLabel(template.difficulty_level)}
              </span>
            </div>

            <p style={styles.cardDescription}>{template.description}</p>

            <div style={styles.cardFooter}>
              <div style={styles.sentenceCount}>
                {template.sentence_count} sentences
              </div>
              <div style={styles.startButton}>Start →</div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No exercises available yet.</p>
          <p style={styles.emptySubtext}>Check back soon for new practice exercises!</p>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '2rem',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 3rem',
    textAlign: 'center' as const,
  },
  backButton: {
    position: 'absolute' as const,
    top: '2rem',
    left: '2rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    color: '#374151',
    transition: 'all 0.2s',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '1rem',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#6b7280',
    maxWidth: '600px',
    margin: '0 auto',
  },
  templatesGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '2rem',
  },
  templateCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    border: '1px solid #e5e7eb',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '1rem',
    gap: '1rem',
  },
  cardTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    margin: 0,
    flex: 1,
  },
  difficultyBadge: {
    padding: '0.25rem 0.75rem',
    borderRadius: '12px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#fff',
    whiteSpace: 'nowrap' as const,
  },
  cardDescription: {
    fontSize: '1rem',
    color: '#6b7280',
    lineHeight: '1.6',
    marginBottom: '1.5rem',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e7eb',
  },
  sentenceCount: {
    fontSize: '0.9rem',
    color: '#6b7280',
  },
  startButton: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  loadingContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center' as const,
    padding: '4rem 0',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#6b7280',
  },
  errorContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    textAlign: 'center' as const,
    padding: '4rem 0',
  },
  errorText: {
    fontSize: '1.2rem',
    color: '#ef4444',
    marginBottom: '1.5rem',
  },
  retryButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  emptyState: {
    maxWidth: '1200px',
    margin: '4rem auto',
    textAlign: 'center' as const,
  },
  emptyText: {
    fontSize: '1.3rem',
    color: '#374151',
    marginBottom: '0.5rem',
  },
  emptySubtext: {
    fontSize: '1rem',
    color: '#6b7280',
  },
};

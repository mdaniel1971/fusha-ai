'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ALL_SURAHS, JUZ_AMMA_START, FIRST_10_SURAHS, SurahInfo } from '@/lib/surahs-data';
import VocabFlashcards from '@/components/exercises/VocabFlashcards';
import TranslationExercise from '@/components/exercises/TranslationExercise';

interface ExerciseTemplate {
  id: string;
  title: string;
  description: string;
  difficulty_level: string;
}

type Step = 'surah-selection' | 'flashcards' | 'exercise';

export default function ExerciseTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.template_id as string;

  const [template, setTemplate] = useState<ExerciseTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSurahs, setSelectedSurahs] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>('surah-selection');

  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [vocabulary, setVocabulary] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchTemplate();
  }, [templateId]);

  const fetchTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (error) throw error;

      setTemplate(data);
    } catch (err) {
      console.error('Error fetching template:', err);
      setError('Failed to load exercise template');
    } finally {
      setLoading(false);
    }
  };

  const toggleSurah = (surahId: number) => {
    setSelectedSurahs((prev) =>
      prev.includes(surahId)
        ? prev.filter((id) => id !== surahId)
        : [...prev, surahId]
    );
  };

  const selectJuzAmma = () => {
    const juzAmmaSurahs = ALL_SURAHS
      .filter((s) => s.id >= JUZ_AMMA_START)
      .map((s) => s.id);
    setSelectedSurahs(juzAmmaSurahs);
  };

  const selectFirst10 = () => {
    const first10 = ALL_SURAHS
      .filter((s) => s.id <= FIRST_10_SURAHS)
      .map((s) => s.id);
    setSelectedSurahs(first10);
  };

  const clearSelection = () => {
    setSelectedSurahs([]);
  };

  const handleContinue = async () => {
    if (selectedSurahs.length === 0) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_template_id: templateId,
          surah_ids: selectedSurahs,
          user_id: crypto.randomUUID(), // Generate a temporary user ID
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate exercise');
      }

      const data = await response.json();
      console.log('[Exercise] API Response:', data);
      console.log('[Exercise] Vocabulary received:', data.vocabulary?.length, 'words');
      if (data.debug) {
        console.log('[Exercise] Debug info:', data.debug);
      }
      setInstanceId(data.instance_id);
      setVocabulary(data.vocabulary || []);
      setCurrentStep('flashcards');
    } catch (err) {
      console.error('Error generating exercise:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate exercise');
    } finally {
      setGenerating(false);
    }
  };

  const handleFlashcardsComplete = () => {
    setCurrentStep('exercise');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading...</div>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div style={styles.container}>
        <div style={styles.errorText}>{error}</div>
        <button onClick={() => router.push('/lessons')} style={styles.button}>
          Back to Lessons
        </button>
      </div>
    );
  }

  if (!template) {
    return (
      <div style={styles.container}>
        <div style={styles.errorText}>Exercise template not found</div>
        <button onClick={() => router.push('/lessons')} style={styles.button}>
          Back to Lessons
        </button>
      </div>
    );
  }

  // Render based on current step
  if (currentStep === 'flashcards' && instanceId) {
    return (
      <VocabFlashcards
        vocabulary={vocabulary}
        onComplete={handleFlashcardsComplete}
      />
    );
  }

  if (currentStep === 'exercise' && instanceId) {
    return (
      <TranslationExercise
        instanceId={instanceId}
        templateTitle={template.title}
      />
    );
  }

  // Surah Selection Screen
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          onClick={() => router.push('/lessons')}
          style={styles.backButton}
        >
          ← Back to Lessons
        </button>
        <h1 style={styles.title}>Select Surahs to Practice</h1>
        <p style={styles.subtitle}>
          Choose which surahs you want to practice vocabulary from
        </p>
        <div style={styles.templateInfo}>
          <strong>{template.title}</strong> - {template.description}
        </div>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          {error}
        </div>
      )}

      <div style={styles.quickSelectContainer}>
        <h3 style={styles.quickSelectTitle}>Quick Select:</h3>
        <div style={styles.quickSelectButtons}>
          <button onClick={selectJuzAmma} style={styles.quickSelectButton}>
            Juz Amma (Surahs 78-114)
          </button>
          <button onClick={selectFirst10} style={styles.quickSelectButton}>
            First 10 Surahs (1-10)
          </button>
          <button
            onClick={clearSelection}
            style={{ ...styles.quickSelectButton, backgroundColor: '#ef4444' }}
          >
            Clear Selection
          </button>
        </div>
      </div>

      <div style={styles.selectedCount}>
        Selected: {selectedSurahs.length} surah{selectedSurahs.length !== 1 ? 's' : ''}
      </div>

      <div style={styles.surahGrid}>
        {ALL_SURAHS.map((surah) => {
          const isSelected = selectedSurahs.includes(surah.id);
          return (
            <div
              key={surah.id}
              style={{
                ...styles.surahCard,
                ...(isSelected ? styles.surahCardSelected : {}),
              }}
              onClick={() => toggleSurah(surah.id)}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={styles.checkbox}
              />
              <div style={styles.surahNumber}>{surah.id}</div>
              <div style={styles.surahNameArabic}>{surah.nameArabic}</div>
              <div style={styles.surahTransliteration}>{surah.transliteration}</div>
              <div style={styles.surahNameEnglish}>{surah.nameEnglish}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <button
          onClick={handleContinue}
          disabled={selectedSurahs.length === 0 || generating}
          style={{
            ...styles.continueButton,
            ...(selectedSurahs.length === 0 || generating
              ? styles.continueButtonDisabled
              : {}),
          }}
        >
          {generating ? 'Generating Exercise...' : 'Continue'}
        </button>
      </div>
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
    maxWidth: '1400px',
    margin: '0 auto 2rem',
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
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1.1rem',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  templateInfo: {
    fontSize: '1rem',
    color: '#374151',
    marginTop: '1rem',
  },
  quickSelectContainer: {
    maxWidth: '1400px',
    margin: '0 auto 2rem',
    padding: '1.5rem',
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  quickSelectTitle: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#1a1a1a',
  },
  quickSelectButtons: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap' as const,
  },
  quickSelectButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  selectedCount: {
    maxWidth: '1400px',
    margin: '0 auto 1rem',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#374151',
  },
  surahGrid: {
    maxWidth: '1400px',
    margin: '0 auto 2rem',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  surahCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '1rem',
    cursor: 'pointer',
    border: '2px solid #e5e7eb',
    transition: 'all 0.2s',
    textAlign: 'center' as const,
  },
  surahCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  checkbox: {
    marginBottom: '0.5rem',
    cursor: 'pointer',
  },
  surahNumber: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: '0.5rem',
  },
  surahNameArabic: {
    fontSize: '1.4rem',
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    color: '#1a1a1a',
    marginBottom: '0.5rem',
    direction: 'rtl' as const,
  },
  surahTransliteration: {
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: '0.25rem',
  },
  surahNameEnglish: {
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  footer: {
    maxWidth: '1400px',
    margin: '0 auto',
    textAlign: 'center' as const,
    position: 'sticky' as const,
    bottom: '2rem',
  },
  continueButton: {
    padding: '1rem 3rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  continueButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#6b7280',
    textAlign: 'center' as const,
    padding: '4rem 0',
  },
  errorText: {
    fontSize: '1.2rem',
    color: '#ef4444',
    textAlign: 'center' as const,
    marginBottom: '1rem',
  },
  errorBanner: {
    maxWidth: '1400px',
    margin: '0 auto 1rem',
    padding: '1rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  button: {
    padding: '0.75rem 2rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    margin: '0 auto',
    display: 'block',
  },
};

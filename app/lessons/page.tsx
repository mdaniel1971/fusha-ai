'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VocabFlashcards from '@/components/exercises/VocabFlashcards';
import TranslationExercise from '@/components/exercises/TranslationExercise';

interface SurahPartOption {
  surah_id: number;
  surah_part: number;
  surah_name_arabic: string;
  surah_name_english: string;
  surah_transliteration: string;
  display_label: string;
}

interface ExerciseOption {
  exercise_name: string;
  exercise_order: number;
  display_label: string;
}

interface VocabWord {
  arabic: string;
  english: string;
  word_type: string;
  source: 'quran' | 'supporting';
}

type Step = 'selection' | 'flashcards' | 'exercise';

export default function LessonsPage() {
  const router = useRouter();

  // Data state
  const [surahParts, setSurahParts] = useState<SurahPartOption[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedSurahParts, setSelectedSurahParts] = useState<SurahPartOption[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseOption | null>(null);

  // Exercise state
  const [currentStep, setCurrentStep] = useState<Step>('selection');
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [flashcardVocabulary, setFlashcardVocabulary] = useState<VocabWord[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch surah parts and exercises in parallel
      const [surahPartsRes, exercisesRes] = await Promise.all([
        fetch('/api/exercises/surah-parts'),
        fetch('/api/exercises/available'),
      ]);

      if (!surahPartsRes.ok || !exercisesRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const surahPartsData = await surahPartsRes.json();
      const exercisesData = await exercisesRes.json();

      setSurahParts(surahPartsData.surah_parts || []);
      setExercises(exercisesData.exercises || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load exercise options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSurahPart = (sp: SurahPartOption) => {
    const key = `${sp.surah_id}-${sp.surah_part}`;
    const isSelected = selectedSurahParts.some(
      s => `${s.surah_id}-${s.surah_part}` === key
    );

    if (isSelected) {
      setSelectedSurahParts(prev =>
        prev.filter(s => `${s.surah_id}-${s.surah_part}` !== key)
      );
    } else {
      setSelectedSurahParts(prev => [...prev, sp]);
    }
  };

  const generateExercise = async () => {
    if (selectedSurahParts.length === 0 || !selectedExercise) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/exercises/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surah_parts: selectedSurahParts.map(sp => ({
            surah_id: sp.surah_id,
            surah_part: sp.surah_part,
          })),
          exercise_name: selectedExercise.exercise_name,
          user_id: crypto.randomUUID(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate exercise');
      }

      const data = await response.json();
      console.log('[Lessons] Generated exercise:', data);

      setInstanceId(data.instance_id);
      setFlashcardVocabulary(data.flashcard_vocabulary || []);
      setCurrentStep('flashcards');
    } catch (err) {
      console.error('Error generating exercise:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate exercise');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    // Generate new sentences with same selections
    setCurrentStep('selection');
    setInstanceId(null);
    // Keep flashcard vocabulary, just regenerate
    setGenerating(true);
    await generateExercise();
  };

  const handleFlashcardsComplete = () => {
    setCurrentStep('exercise');
  };

  const handleBackToSelection = () => {
    setCurrentStep('selection');
    setInstanceId(null);
    setFlashcardVocabulary([]);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.loadingText}>Loading exercise options...</div>
        </div>
      </div>
    );
  }

  // Flashcards step
  if (currentStep === 'flashcards' && flashcardVocabulary.length > 0) {
    return (
      <VocabFlashcards
        vocabulary={flashcardVocabulary}
        onComplete={handleFlashcardsComplete}
        exerciseName={selectedExercise?.display_label || 'Exercise'}
      />
    );
  }

  // Exercise step
  if (currentStep === 'exercise' && instanceId) {
    return (
      <TranslationExercise
        instanceId={instanceId}
        templateTitle={selectedExercise?.display_label || 'Exercise'}
        onRegenerate={handleRegenerate}
        onBackToSelection={handleBackToSelection}
      />
    );
  }

  // Selection step
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => router.push('/lesson')} style={styles.backButton}>
          ← Back to Lesson
        </button>
        <h1 style={styles.title}>Practice Exercises</h1>
        <p style={styles.subtitle}>
          Select surah parts and an exercise type to begin
        </p>
      </div>

      {error && (
        <div style={styles.errorBanner}>
          {error}
          <button onClick={() => setError(null)} style={styles.dismissButton}>×</button>
        </div>
      )}

      <div style={styles.selectionContainer}>
        {/* Surah Parts Selection */}
        <div style={styles.selectionSection}>
          <h2 style={styles.sectionTitle}>1. Select Surah Parts</h2>
          <p style={styles.sectionDescription}>
            Choose which parts of the Quran you want to practice vocabulary from
          </p>

          {surahParts.length === 0 ? (
            <div style={styles.emptyState}>
              No surah parts available. Please add Quran vocabulary data to quran_words table.
            </div>
          ) : (
            <div style={styles.surahPartsGrid}>
              {surahParts.map(sp => {
                const key = `${sp.surah_id}-${sp.surah_part}`;
                const isSelected = selectedSurahParts.some(
                  s => `${s.surah_id}-${s.surah_part}` === key
                );
                return (
                  <div
                    key={key}
                    style={{
                      ...styles.surahPartCard,
                      ...(isSelected ? styles.surahPartCardSelected : {}),
                    }}
                    onClick={() => toggleSurahPart(sp)}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      style={styles.checkbox}
                    />
                    <div style={styles.surahPartInfo}>
                      <div style={styles.surahPartArabic}>{sp.surah_name_arabic}</div>
                      <div style={styles.surahPartLabel}>{sp.display_label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={styles.selectionCount}>
            Selected: {selectedSurahParts.length} part{selectedSurahParts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Exercise Selection */}
        <div style={styles.selectionSection}>
          <h2 style={styles.sectionTitle}>2. Select Exercise</h2>
          <p style={styles.sectionDescription}>
            Choose which grammar exercise you want to practice
          </p>

          {exercises.length === 0 ? (
            <div style={styles.emptyState}>
              No exercises available. Please add exercise data to supporting_words table.
            </div>
          ) : (
            <div style={styles.exercisesList}>
              {exercises.map(ex => {
                const isSelected = selectedExercise?.exercise_name === ex.exercise_name;
                return (
                  <div
                    key={ex.exercise_name}
                    style={{
                      ...styles.exerciseCard,
                      ...(isSelected ? styles.exerciseCardSelected : {}),
                    }}
                    onClick={() => setSelectedExercise(ex)}
                  >
                    <div style={styles.exerciseRadio}>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        style={styles.radio}
                      />
                    </div>
                    <div style={styles.exerciseInfo}>
                      <div style={styles.exerciseOrder}>Exercise {ex.exercise_order}</div>
                      <div style={styles.exerciseName}>{ex.display_label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Start Button */}
      <div style={styles.footer}>
        <button
          onClick={generateExercise}
          disabled={selectedSurahParts.length === 0 || !selectedExercise || generating}
          style={{
            ...styles.startButton,
            ...(selectedSurahParts.length === 0 || !selectedExercise || generating
              ? styles.startButtonDisabled
              : {}),
          }}
        >
          {generating ? 'Generating Exercise...' : 'Start Exercise'}
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
    maxWidth: '1200px',
    margin: '0 auto 2rem',
    textAlign: 'center' as const,
    position: 'relative' as const,
  },
  backButton: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
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
  },
  errorBanner: {
    maxWidth: '1200px',
    margin: '0 auto 1rem',
    padding: '1rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.5rem',
    cursor: 'pointer',
    color: '#991b1b',
  },
  selectionContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '2rem',
  },
  selectionSection: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '0.5rem',
  },
  sectionDescription: {
    fontSize: '1rem',
    color: '#6b7280',
    marginBottom: '1.5rem',
  },
  surahPartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '0.75rem',
    maxHeight: '400px',
    overflowY: 'auto' as const,
    padding: '0.5rem',
  },
  surahPartCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem',
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  surahPartCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  surahPartInfo: {
    flex: 1,
  },
  surahPartArabic: {
    fontSize: '1.2rem',
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    color: '#1a1a1a',
    direction: 'rtl' as const,
  },
  surahPartLabel: {
    fontSize: '0.85rem',
    color: '#6b7280',
  },
  selectionCount: {
    marginTop: '1rem',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#374151',
  },
  exercisesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  exerciseCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  exerciseCardSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  exerciseRadio: {
    display: 'flex',
    alignItems: 'center',
  },
  radio: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseOrder: {
    fontSize: '0.85rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
  },
  exerciseName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  footer: {
    maxWidth: '1200px',
    margin: '2rem auto 0',
    textAlign: 'center' as const,
  },
  startButton: {
    padding: '1rem 4rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
  },
  startButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '50vh',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#6b7280',
  },
  emptyState: {
    padding: '2rem',
    textAlign: 'center' as const,
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
};

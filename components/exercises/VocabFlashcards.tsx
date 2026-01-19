'use client';

import { useState } from 'react';
import { ALL_SURAHS } from '@/lib/surahs-data';

interface VocabWord {
  arabic: string;
  english: string;
  word_type: string;
  surahs: number[];
}

interface VocabFlashcardsProps {
  vocabulary: VocabWord[];
  onComplete: () => void;
}

export default function VocabFlashcards({ vocabulary, onComplete }: VocabFlashcardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!vocabulary || vocabulary.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.errorText}>No vocabulary available</div>
        <button onClick={onComplete} style={styles.button}>
          Continue Anyway
        </button>
      </div>
    );
  }

  const currentWord = vocabulary[currentIndex];
  const totalWords = vocabulary.length;

  const handleNext = () => {
    if (currentIndex < totalWords - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const getSurahNames = (surahIds: number[]) => {
    return surahIds
      .map((id) => {
        const surah = ALL_SURAHS.find((s) => s.id === id);
        return surah ? surah.transliteration : `Surah ${id}`;
      })
      .join(', ');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Study the Vocabulary</h1>
        <p style={styles.subtitle}>
          Review these words before starting the translation exercise
        </p>
      </div>

      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${((currentIndex + 1) / totalWords) * 100}%`,
          }}
        />
      </div>

      <div style={styles.progressText}>
        Card {currentIndex + 1} of {totalWords}
      </div>

      <div
        style={styles.flashcardContainer}
        onClick={handleFlip}
      >
        <div
          style={{
            ...styles.flashcard,
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front - Arabic */}
          <div
            style={{
              ...styles.flashcardFace,
              ...styles.flashcardFront,
              opacity: isFlipped ? 0 : 1,
            }}
          >
            <div style={styles.flipHint}>Click to flip</div>
            <div style={styles.arabicText}>{currentWord.arabic}</div>
          </div>

          {/* Back - English */}
          <div
            style={{
              ...styles.flashcardFace,
              ...styles.flashcardBack,
              opacity: isFlipped ? 1 : 0,
            }}
          >
            <div style={styles.flipHint}>Click to flip back</div>
            <div style={styles.englishText}>{currentWord.english}</div>
            <div style={styles.wordType}>
              <strong>Type:</strong> {currentWord.word_type}
            </div>
            <div style={styles.surahInfo}>
              <strong>Found in:</strong> {getSurahNames(currentWord.surahs)}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.navigation}>
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          style={{
            ...styles.navButton,
            ...(currentIndex === 0 ? styles.navButtonDisabled : {}),
          }}
        >
          ← Previous
        </button>

        <button onClick={handleFlip} style={styles.flipButton}>
          {isFlipped ? 'Show Arabic' : 'Show English'}
        </button>

        <button
          onClick={handleNext}
          disabled={currentIndex === totalWords - 1}
          style={{
            ...styles.navButton,
            ...(currentIndex === totalWords - 1 ? styles.navButtonDisabled : {}),
          }}
        >
          Next →
        </button>
      </div>

      <div style={styles.footer}>
        <button onClick={onComplete} style={styles.continueButton}>
          I've Studied These - Start Exercise
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
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
  progressBar: {
    width: '100%',
    maxWidth: '600px',
    height: '8px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '1rem',
    color: '#6b7280',
    marginBottom: '2rem',
  },
  flashcardContainer: {
    perspective: '1000px',
    width: '100%',
    maxWidth: '600px',
    height: '400px',
    marginBottom: '2rem',
    cursor: 'pointer',
  },
  flashcard: {
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d' as const,
    transition: 'transform 0.6s',
  },
  flashcardFace: {
    position: 'absolute' as const,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden' as const,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
    padding: '3rem',
    transition: 'opacity 0.3s',
  },
  flashcardFront: {
    transform: 'rotateY(0deg)',
  },
  flashcardBack: {
    transform: 'rotateY(180deg)',
  },
  flipHint: {
    position: 'absolute' as const,
    top: '1rem',
    fontSize: '0.85rem',
    color: '#9ca3af',
  },
  arabicText: {
    fontSize: '3.5rem',
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    color: '#1a1a1a',
    direction: 'rtl' as const,
    textAlign: 'center' as const,
  },
  englishText: {
    fontSize: '2.5rem',
    color: '#1a1a1a',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  wordType: {
    fontSize: '1.1rem',
    color: '#6b7280',
    marginTop: '1rem',
  },
  surahInfo: {
    fontSize: '0.95rem',
    color: '#6b7280',
    marginTop: '0.5rem',
    textAlign: 'center' as const,
  },
  navigation: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '2rem',
  },
  navButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#fff',
    border: '2px solid #3b82f6',
    color: '#3b82f6',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  navButtonDisabled: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  flipButton: {
    padding: '0.75rem 2rem',
    backgroundColor: '#f59e0b',
    border: 'none',
    color: '#fff',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  footer: {
    textAlign: 'center' as const,
  },
  continueButton: {
    padding: '1rem 3rem',
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
  },
  errorText: {
    fontSize: '1.2rem',
    color: '#ef4444',
    marginBottom: '1rem',
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
  },
};

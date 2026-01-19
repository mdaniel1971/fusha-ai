'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ExerciseResults from './ExerciseResults';

interface Sentence {
  sentence_number: number;
  arabic_text: string;
  english_translation: string;
}

interface TranslationExerciseProps {
  instanceId: string;
  templateTitle: string;
}

type FeedbackState = 'none' | 'correct' | 'incorrect';

export default function TranslationExercise({ instanceId, templateTitle }: TranslationExerciseProps) {
  const router = useRouter();

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>('none');
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const id = crypto.randomUUID();
    setUserId(id);
    fetchExercise();
  }, [instanceId]);

  const fetchExercise = async () => {
    try {
      const { data, error } = await supabase
        .from('exercise_instances')
        .select('generated_sentences')
        .eq('id', instanceId)
        .single();

      if (error) throw error;

      if (!data || !data.generated_sentences) {
        throw new Error('No sentences found for this exercise');
      }

      setSentences(data.generated_sentences as Sentence[]);
    } catch (err) {
      console.error('Error fetching exercise:', err);
      setError('Failed to load exercise');
    } finally {
      setLoading(false);
    }
  };

  const normalizeAnswer = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]/g, '') // Remove punctuation
      .replace(/\s+/g, ' '); // Normalize whitespace
  };

  const checkAnswer = async () => {
    if (!userAnswer.trim()) return;

    const currentSentence = sentences[currentIndex];
    const normalizedUserAnswer = normalizeAnswer(userAnswer);
    const normalizedCorrectAnswer = normalizeAnswer(currentSentence.english_translation);

    // Simple similarity check: exact match or reasonable variation
    const isCorrect =
      normalizedUserAnswer === normalizedCorrectAnswer ||
      normalizedUserAnswer.includes(normalizedCorrectAnswer) ||
      normalizedCorrectAnswer.includes(normalizedUserAnswer);

    setFeedback(isCorrect ? 'correct' : 'incorrect');

    if (isCorrect) {
      setScore(score + 1);
    }

    // Log attempt to database
    try {
      await supabase.from('exercise_attempts').insert({
        user_id: userId,
        exercise_instance_id: instanceId,
        sentence_number: currentSentence.sentence_number,
        user_answer: userAnswer,
        correct_answer: currentSentence.english_translation,
        is_correct: isCorrect,
      });
    } catch (err) {
      console.error('Error logging attempt:', err);
    }
  };

  const handleNext = () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setUserAnswer('');
      setFeedback('none');
    } else {
      // Exercise complete
      setShowResults(true);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading exercise...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorText}>{error}</div>
        <button onClick={() => router.push('/lessons')} style={styles.button}>
          Back to Lessons
        </button>
      </div>
    );
  }

  if (showResults) {
    return <ExerciseResults instanceId={instanceId} userId={userId} />;
  }

  const currentSentence = sentences[currentIndex];
  const totalSentences = sentences.length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{templateTitle}</h1>
        <div style={styles.scoreContainer}>
          <div style={styles.scoreLabel}>Score:</div>
          <div style={styles.scoreValue}>
            {score}/{totalSentences}
          </div>
        </div>
      </div>

      <div style={styles.progressBar}>
        <div
          style={{
            ...styles.progressFill,
            width: `${((currentIndex + 1) / totalSentences) * 100}%`,
          }}
        />
      </div>

      <div style={styles.progressText}>
        Question {currentIndex + 1} of {totalSentences}
      </div>

      <div style={styles.exerciseCard}>
        <div style={styles.directionLabel}>Translate from Arabic to English:</div>

        <div style={styles.arabicSentence}>{currentSentence.arabic_text}</div>

        <div style={styles.inputContainer}>
          <input
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && feedback === 'none') {
                checkAnswer();
              }
            }}
            disabled={feedback !== 'none'}
            placeholder="Type your English translation here..."
            style={styles.input}
            autoFocus
          />
        </div>

        {feedback === 'none' && (
          <button
            onClick={checkAnswer}
            disabled={!userAnswer.trim()}
            style={{
              ...styles.checkButton,
              ...(userAnswer.trim() ? {} : styles.checkButtonDisabled),
            }}
          >
            Check Answer
          </button>
        )}

        {feedback === 'correct' && (
          <div style={styles.feedbackCorrect}>
            <div style={styles.feedbackIcon}>✓</div>
            <div style={styles.feedbackText}>Correct!</div>
            <button onClick={handleNext} style={styles.nextButton}>
              {currentIndex < totalSentences - 1 ? 'Next Question' : 'See Results'}
            </button>
          </div>
        )}

        {feedback === 'incorrect' && (
          <div style={styles.feedbackIncorrect}>
            <div style={styles.feedbackIcon}>✗</div>
            <div style={styles.feedbackText}>
              <div style={styles.yourAnswer}>
                <strong>Your answer:</strong> {userAnswer}
              </div>
              <div style={styles.correctAnswer}>
                <strong>Correct answer:</strong> {currentSentence.english_translation}
              </div>
            </div>
            <button onClick={handleNext} style={styles.nextButton}>
              {currentIndex < totalSentences - 1 ? 'Next Question' : 'See Results'}
            </button>
          </div>
        )}
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
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scoreContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  scoreLabel: {
    fontSize: '1.1rem',
    color: '#6b7280',
  },
  scoreValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  progressBar: {
    width: '100%',
    maxWidth: '800px',
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
  exerciseCard: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '3rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
  },
  directionLabel: {
    fontSize: '1.1rem',
    color: '#6b7280',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  arabicSentence: {
    fontSize: '2.5rem',
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    color: '#1a1a1a',
    direction: 'rtl' as const,
    textAlign: 'center' as const,
    marginBottom: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '12px',
  },
  inputContainer: {
    marginBottom: '1.5rem',
  },
  input: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.1rem',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  checkButton: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  checkButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
  feedbackCorrect: {
    textAlign: 'center' as const,
    padding: '2rem',
    backgroundColor: '#dcfce7',
    borderRadius: '12px',
  },
  feedbackIncorrect: {
    textAlign: 'center' as const,
    padding: '2rem',
    backgroundColor: '#fee2e2',
    borderRadius: '12px',
  },
  feedbackIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  feedbackText: {
    fontSize: '1.1rem',
    marginBottom: '1.5rem',
  },
  yourAnswer: {
    color: '#ef4444',
    marginBottom: '0.5rem',
  },
  correctAnswer: {
    color: '#22c55e',
  },
  nextButton: {
    padding: '1rem 3rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  loadingText: {
    fontSize: '1.2rem',
    color: '#6b7280',
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

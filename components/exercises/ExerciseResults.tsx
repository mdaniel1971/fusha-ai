'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface Attempt {
  sentence_number: number;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
}

interface Sentence {
  sentence_number: number;
  arabic_text: string;
  english_translation: string;
}

interface ExerciseResultsProps {
  instanceId: string;
  userId: string;
}

export default function ExerciseResults({ instanceId, userId }: ExerciseResultsProps) {
  const router = useRouter();

  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>('');
  const [surahIds, setSurahIds] = useState<number[]>([]);

  useEffect(() => {
    fetchResults();
  }, [instanceId, userId]);

  const fetchResults = async () => {
    try {
      // Fetch exercise instance to get template_id, surah_ids, and sentences
      const { data: instance, error: instanceError } = await supabase
        .from('exercise_instances')
        .select('exercise_template_id, surah_ids, generated_sentences')
        .eq('id', instanceId)
        .single();

      if (instanceError) throw instanceError;

      setTemplateId(instance.exercise_template_id);
      setSurahIds(instance.surah_ids || []);
      setSentences(instance.generated_sentences as Sentence[]);

      // Fetch attempts
      const { data: attemptsData, error: attemptsError } = await supabase
        .from('exercise_attempts')
        .select('*')
        .eq('exercise_instance_id', instanceId)
        .eq('user_id', userId)
        .order('sentence_number', { ascending: true });

      if (attemptsError) throw attemptsError;

      setAttempts(attemptsData || []);
    } catch (err) {
      console.error('Error fetching results:', err);
      setError('Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handlePracticeAgain = async () => {
    // Navigate back to surah selection with same template
    router.push(`/lessons/${templateId}`);
  };

  const handleChangeSurahs = () => {
    router.push(`/lessons/${templateId}`);
  };

  const handleBackToChat = () => {
    router.push('/lesson');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingText}>Loading results...</div>
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

  const totalQuestions = attempts.length;
  const correctAnswers = attempts.filter((a) => a.is_correct).length;
  const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const incorrectAttempts = attempts.filter((a) => !a.is_correct);

  const getPerformanceMessage = () => {
    if (percentage >= 90) {
      return "Excellent! You've mastered this vocabulary!";
    } else if (percentage >= 70) {
      return 'Good work! Review the mistakes below.';
    } else if (percentage >= 50) {
      return 'Keep practicing. Review these words.';
    } else {
      return 'Study the vocabulary again and try a new exercise.';
    }
  };

  const getScoreColor = () => {
    if (percentage >= 90) return '#22c55e';
    if (percentage >= 70) return '#3b82f6';
    if (percentage >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Exercise Complete!</h1>
      </div>

      <div style={styles.scoreCard}>
        <div
          style={{
            ...styles.scoreCircle,
            borderColor: getScoreColor(),
          }}
        >
          <div style={{ ...styles.scorePercentage, color: getScoreColor() }}>
            {percentage}%
          </div>
          <div style={styles.scoreFraction}>
            {correctAnswers}/{totalQuestions}
          </div>
        </div>
        <div style={styles.performanceMessage}>{getPerformanceMessage()}</div>
      </div>

      {incorrectAttempts.length > 0 && (
        <div style={styles.mistakesSection}>
          <h2 style={styles.mistakesTitle}>Review Your Mistakes</h2>
          {incorrectAttempts.map((attempt) => {
            const sentence = sentences.find((s) => s.sentence_number === attempt.sentence_number);
            return (
              <div key={attempt.sentence_number} style={styles.mistakeCard}>
                <div style={styles.mistakeNumber}>Question {attempt.sentence_number}</div>
                {sentence && (
                  <div style={styles.arabicText}>{sentence.arabic_text}</div>
                )}
                <div style={styles.answerComparison}>
                  <div style={styles.yourAnswerBox}>
                    <div style={styles.answerLabel}>Your answer:</div>
                    <div style={styles.yourAnswerText}>{attempt.user_answer}</div>
                  </div>
                  <div style={styles.correctAnswerBox}>
                    <div style={styles.answerLabel}>Correct answer:</div>
                    <div style={styles.correctAnswerText}>{attempt.correct_answer}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {incorrectAttempts.length === 0 && (
        <div style={styles.perfectScore}>
          <div style={styles.perfectIcon}>🎉</div>
          <div style={styles.perfectText}>Perfect Score!</div>
          <div style={styles.perfectSubtext}>
            You got all questions correct. Excellent work!
          </div>
        </div>
      )}

      <div style={styles.actionButtons}>
        <button onClick={handlePracticeAgain} style={styles.primaryButton}>
          Practice Again
        </button>
        <button onClick={handleChangeSurahs} style={styles.secondaryButton}>
          Choose Different Surahs
        </button>
        <button onClick={handleBackToChat} style={styles.secondaryButton}>
          Back to Chat
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
    textAlign: 'center' as const,
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  scoreCard: {
    maxWidth: '600px',
    margin: '0 auto 3rem',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '3rem',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
  },
  scoreCircle: {
    width: '200px',
    height: '200px',
    margin: '0 auto 2rem',
    borderRadius: '50%',
    border: '8px solid',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePercentage: {
    fontSize: '3.5rem',
    fontWeight: 'bold',
  },
  scoreFraction: {
    fontSize: '1.2rem',
    color: '#6b7280',
    marginTop: '0.5rem',
  },
  performanceMessage: {
    fontSize: '1.5rem',
    color: '#374151',
    fontWeight: 'bold',
  },
  mistakesSection: {
    maxWidth: '800px',
    margin: '0 auto 3rem',
  },
  mistakesTitle: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
  },
  mistakeCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    marginBottom: '1.5rem',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  mistakeNumber: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: '1rem',
  },
  arabicText: {
    fontSize: '2rem',
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    color: '#1a1a1a',
    direction: 'rtl' as const,
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  answerComparison: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  yourAnswerBox: {
    padding: '1rem',
    backgroundColor: '#fee2e2',
    borderRadius: '8px',
  },
  correctAnswerBox: {
    padding: '1rem',
    backgroundColor: '#dcfce7',
    borderRadius: '8px',
  },
  answerLabel: {
    fontSize: '0.85rem',
    fontWeight: 'bold',
    color: '#6b7280',
    marginBottom: '0.5rem',
  },
  yourAnswerText: {
    fontSize: '1.1rem',
    color: '#ef4444',
  },
  correctAnswerText: {
    fontSize: '1.1rem',
    color: '#22c55e',
  },
  perfectScore: {
    maxWidth: '600px',
    margin: '0 auto 3rem',
    textAlign: 'center' as const,
    padding: '3rem',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
  },
  perfectIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  perfectText: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: '0.5rem',
  },
  perfectSubtext: {
    fontSize: '1.2rem',
    color: '#6b7280',
  },
  actionButtons: {
    maxWidth: '600px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  primaryButton: {
    padding: '1rem 2rem',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  secondaryButton: {
    padding: '1rem 2rem',
    backgroundColor: '#fff',
    color: '#3b82f6',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
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

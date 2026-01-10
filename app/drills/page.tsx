'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DrillOption {
  id: string;
  text: string;
  textArabic: string;
  isCorrect: boolean;
}

interface Drill {
  id: string;
  grammarFeature: string;
  grammarValue: string;
  drillType: 'multiple_choice' | 'fill_in_blank' | 'case_selection';
  question: string;
  questionArabic?: string;
  options: DrillOption[];
  correctAnswer: string;
  correctAnswerArabic: string;
  explanation: string;
  wordId?: number;
  transliteration?: string;
}

interface TargetedFeature {
  feature: string;
  value: string;
  struggleCount: number;
}

export default function DrillsPage() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [targetedFeatures, setTargetedFeatures] = useState<TargetedFeature[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [userId] = useState(() => {
    // Use a persistent user ID from localStorage
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('fushaai_user_id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('fushaai_user_id', id);
      }
      return id;
    }
    return crypto.randomUUID();
  });
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    fetchDrills();
  }, [userId]);

  const fetchDrills = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/drills/generate?userId=${userId}&limit=5`);
      if (!response.ok) throw new Error('Failed to load drills');
      const data = await response.json();
      setDrills(data.drills || []);
      setTargetedFeatures(data.targetedFeatures || []);
      setCurrentIndex(0);
      setScore({ correct: 0, total: 0 });
      setCompleted(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drills');
    } finally {
      setLoading(false);
    }
  };

  const currentDrill = drills[currentIndex];

  const handleOptionSelect = (optionId: string) => {
    if (showResult) return;
    setSelectedOption(optionId);
  };

  const handleSubmit = async () => {
    if (!selectedOption || !currentDrill) return;

    const selected = currentDrill.options.find(o => o.id === selectedOption);
    const correct = selected?.isCorrect || false;
    setIsCorrect(correct);
    setShowResult(true);
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    // Record the result
    try {
      await fetch('/api/drills/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          userId,
          wordId: currentDrill.wordId,
          grammarFeature: currentDrill.grammarFeature,
          grammarValue: currentDrill.grammarValue,
          isCorrect: correct,
          userAnswer: selected?.text,
        }),
      });
    } catch (err) {
      console.error('Failed to record drill result:', err);
    }
  };

  const handleNext = () => {
    if (currentIndex < drills.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setCompleted(true);
    }
  };

  const formatFeature = (feature: string) => {
    return feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
      }}>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Loading drills...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        gap: '1rem',
      }}>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#c00' }}>{error}</p>
        <button
          onClick={fetchDrills}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }

  if (drills.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333', marginBottom: '1rem' }}>
          No Drills Available
        </h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666', marginBottom: '2rem', maxWidth: '400px' }}>
          Complete some lessons first to identify areas for practice. Drills are generated based on grammar features you are struggling with.
        </p>
        <Link
          href="/lesson"
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontFamily: 'Arial, sans-serif',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            textDecoration: 'none',
          }}
        >
          Start a Lesson
        </Link>
      </div>
    );
  }

  if (completed) {
    const percentage = Math.round((score.correct / score.total) * 100);
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <h1 style={{ fontFamily: 'Arial, sans-serif', color: '#333', marginBottom: '0.5rem' }}>
          Drills Complete!
        </h1>
        <div style={{
          fontSize: '3rem',
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          color: percentage >= 80 ? '#22c55e' : percentage >= 60 ? '#f59e0b' : '#ef4444',
          marginBottom: '1rem',
        }}>
          {percentage}%
        </div>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666', marginBottom: '0.5rem' }}>
          {score.correct} out of {score.total} correct
        </p>
        <p style={{
          fontFamily: 'Arial, sans-serif',
          color: '#666',
          marginBottom: '2rem',
          maxWidth: '400px',
        }}>
          {percentage >= 80 ? 'Excellent work! You are making great progress.' :
           percentage >= 60 ? 'Good effort! Keep practicing to improve.' :
           'Keep going! Practice makes perfect.'}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={fetchDrills}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            More Drills
          </button>
          <Link
            href="/progress"
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              backgroundColor: '#fff',
              color: '#3b82f6',
              border: '2px solid #3b82f6',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            View Progress
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '1rem',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link
          href="/"
          style={{
            fontFamily: 'Arial, sans-serif',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          ← Back
        </Link>
        <div style={{
          fontFamily: 'Arial, sans-serif',
          color: '#666',
          fontSize: '0.9rem',
        }}>
          {currentIndex + 1} / {drills.length}
        </div>
        <div style={{
          fontFamily: 'Arial, sans-serif',
          color: '#22c55e',
          fontSize: '0.9rem',
          fontWeight: 'bold',
        }}>
          {score.correct} correct
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto 1.5rem',
        height: '4px',
        backgroundColor: '#e5e5e5',
        borderRadius: '2px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${((currentIndex + (showResult ? 1 : 0)) / drills.length) * 100}%`,
          height: '100%',
          backgroundColor: '#3b82f6',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Targeted features info */}
      {targetedFeatures.length > 0 && currentIndex === 0 && !showResult && (
        <div style={{
          maxWidth: '600px',
          margin: '0 auto 1rem',
          padding: '0.75rem 1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontFamily: 'Arial, sans-serif',
          fontSize: '0.85rem',
          color: '#92400e',
        }}>
          Focusing on: {targetedFeatures.slice(0, 3).map(f => formatFeature(f.feature)).join(', ')}
        </div>
      )}

      {/* Drill card */}
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        padding: '2rem',
      }}>
        {/* Feature badge */}
        <div style={{
          display: 'inline-block',
          padding: '0.25rem 0.75rem',
          backgroundColor: '#e0f2fe',
          color: '#0369a1',
          borderRadius: '999px',
          fontSize: '0.75rem',
          fontFamily: 'Arial, sans-serif',
          marginBottom: '1rem',
        }}>
          {formatFeature(currentDrill.grammarFeature)}
        </div>

        {/* Question */}
        <h2 style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '1.1rem',
          color: '#333',
          marginBottom: '1rem',
          lineHeight: 1.4,
        }}>
          {currentDrill.question}
        </h2>

        {/* Arabic word */}
        {currentDrill.questionArabic && (
          <div style={{
            fontFamily: "'Amiri', serif",
            fontSize: '2.5rem',
            color: '#1a1a1a',
            textAlign: 'center',
            marginBottom: '0.5rem',
            lineHeight: 1.6,
          }}>
            {currentDrill.questionArabic}
          </div>
        )}

        {/* Transliteration */}
        {currentDrill.transliteration && (
          <div style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '0.9rem',
            color: '#666',
            textAlign: 'center',
            fontStyle: 'italic',
            marginBottom: '1.5rem',
          }}>
            {currentDrill.transliteration}
          </div>
        )}

        {/* Options */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {currentDrill.options.map((option) => {
            let backgroundColor = '#fff';
            let borderColor = '#ddd';
            let textColor = '#333';

            if (selectedOption === option.id) {
              if (showResult) {
                if (option.isCorrect) {
                  backgroundColor = '#dcfce7';
                  borderColor = '#22c55e';
                  textColor = '#166534';
                } else {
                  backgroundColor = '#fee2e2';
                  borderColor = '#ef4444';
                  textColor = '#991b1b';
                }
              } else {
                backgroundColor = '#e0f2fe';
                borderColor = '#3b82f6';
              }
            } else if (showResult && option.isCorrect) {
              backgroundColor = '#dcfce7';
              borderColor = '#22c55e';
              textColor = '#166534';
            }

            return (
              <button
                key={option.id}
                onClick={() => handleOptionSelect(option.id)}
                disabled={showResult}
                style={{
                  padding: '1rem',
                  backgroundColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: '12px',
                  cursor: showResult ? 'default' : 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  opacity: showResult && selectedOption !== option.id && !option.isCorrect ? 0.5 : 1,
                }}
              >
                <div style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '1rem',
                  color: textColor,
                }}>
                  {option.text}
                </div>
                {option.textArabic && (
                  <div style={{
                    fontFamily: "'Amiri', serif",
                    fontSize: '1.2rem',
                    color: textColor,
                    marginTop: '0.25rem',
                  }}>
                    {option.textArabic}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Result feedback */}
        {showResult && (
          <div style={{
            padding: '1rem',
            backgroundColor: isCorrect ? '#dcfce7' : '#fef3c7',
            borderRadius: '8px',
            marginBottom: '1rem',
          }}>
            <div style={{
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              color: isCorrect ? '#166534' : '#92400e',
              marginBottom: '0.5rem',
            }}>
              {isCorrect ? 'Correct!' : 'Not quite'}
            </div>
            <div style={{
              fontFamily: 'Arial, sans-serif',
              fontSize: '0.9rem',
              color: '#333',
              lineHeight: 1.5,
            }}>
              {currentDrill.explanation}
            </div>
            {!isCorrect && (
              <div style={{
                marginTop: '0.75rem',
                fontFamily: 'Arial, sans-serif',
                fontSize: '0.9rem',
                color: '#333',
              }}>
                Correct answer: <strong>{currentDrill.correctAnswer}</strong>
                {currentDrill.correctAnswerArabic && (
                  <span style={{ fontFamily: "'Amiri', serif", marginLeft: '0.5rem' }}>
                    ({currentDrill.correctAnswerArabic})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action button */}
        {!showResult ? (
          <button
            onClick={handleSubmit}
            disabled={!selectedOption}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              backgroundColor: selectedOption ? '#3b82f6' : '#e5e5e5',
              color: selectedOption ? '#fff' : '#999',
              border: 'none',
              borderRadius: '12px',
              cursor: selectedOption ? 'pointer' : 'not-allowed',
            }}
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              fontWeight: 'bold',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            {currentIndex < drills.length - 1 ? 'Next' : 'See Results'}
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import type { LearningReport, GrammarBreakdown, TranslationBreakdown, WordMistake } from '@/lib/reportGenerator';

interface LearningReportProps {
  sessionId: string;
  onClose: () => void;
}

interface ReportWithMessage extends LearningReport {
  motivationalMessage: string;
}

export default function LearningReportComponent({ sessionId, onClose }: LearningReportProps) {
  const [report, setReport] = useState<ReportWithMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to generate report');
        }

        const data = await response.json();
        setReport(data);

        // Animate the score
        const targetScore = data.sessionSummary.overallScore;
        let current = 0;
        const increment = targetScore / 50;
        const timer = setInterval(() => {
          current += increment;
          if (current >= targetScore) {
            setAnimatedScore(targetScore);
            clearInterval(timer);
          } else {
            setAnimatedScore(Math.floor(current));
          }
        }, 20);

        return () => clearInterval(timer);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.loadingContainer}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Generating your learning report...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <h2 style={styles.errorTitle}>Oops!</h2>
          <p style={styles.errorText}>{error || 'Failed to load report'}</p>
          <button onClick={onClose} style={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  }

  const scoreColor = report.sessionSummary.overallScore >= 75 ? '#22c55e' :
                     report.sessionSummary.overallScore >= 50 ? '#f59e0b' : '#ef4444';

  const hasData = report.grammarBreakdown.length > 0 || report.translationBreakdown.total > 0;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <button onClick={onClose} style={styles.closeX}>x</button>

        {/* Hero Section */}
        <div style={{ ...styles.heroSection, background: `linear-gradient(135deg, ${scoreColor}22, ${scoreColor}11)` }}>
          <div style={styles.scoreCircle}>
            <span style={{ ...styles.scoreNumber, color: scoreColor }}>{animatedScore}</span>
            <span style={styles.scoreLabel}>Score</span>
          </div>
          <p style={styles.motivationalMessage}>{report.motivationalMessage}</p>
          <div style={styles.statsRow}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{report.sessionSummary.timeSpent || '<1'}</span>
              <span style={styles.statLabel}>min</span>
            </div>
            <div style={styles.stat}>
              <span style={styles.statValue}>{report.sessionSummary.totalInteractions}</span>
              <span style={styles.statLabel}>questions</span>
            </div>
            <div style={styles.stat}>
              <span style={{ ...styles.statValue, color: '#3b82f6' }}>{report.sessionSummary.grammarAccuracy}%</span>
              <span style={styles.statLabel}>grammar</span>
            </div>
            <div style={styles.stat}>
              <span style={{ ...styles.statValue, color: '#8b5cf6' }}>{report.sessionSummary.translationAccuracy}%</span>
              <span style={styles.statLabel}>vocab</span>
            </div>
          </div>
        </div>

        <div style={styles.scrollContainer}>
          {/* Top Strengths & Weaknesses */}
          {(report.topStrengths.length > 0 || report.topWeaknesses.length > 0) && (
            <div style={styles.summaryRow}>
              {report.topStrengths.length > 0 && (
                <div style={{ ...styles.summaryCard, borderColor: '#22c55e' }}>
                  <h3 style={{ ...styles.summaryTitle, color: '#22c55e' }}>Strengths</h3>
                  {report.topStrengths.map((s, i) => (
                    <p key={i} style={styles.summaryItem}>{s}</p>
                  ))}
                </div>
              )}
              {report.topWeaknesses.length > 0 && (
                <div style={{ ...styles.summaryCard, borderColor: '#ef4444' }}>
                  <h3 style={{ ...styles.summaryTitle, color: '#ef4444' }}>Needs Work</h3>
                  {report.topWeaknesses.map((w, i) => (
                    <p key={i} style={styles.summaryItem}>{w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Grammar Breakdown */}
          {report.grammarBreakdown.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#3b82f6' }}>
                Grammar Breakdown
              </h3>
              {report.grammarBreakdown.map((gb, i) => (
                <GrammarCard key={i} breakdown={gb} />
              ))}
            </section>
          )}

          {/* Vocabulary Breakdown */}
          {report.translationBreakdown.total > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#8b5cf6' }}>
                Vocabulary Breakdown
              </h3>
              <VocabularyCard breakdown={report.translationBreakdown} />
            </section>
          )}

          {/* Empty State */}
          {!hasData && (
            <div style={styles.emptyState}>
              <p style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>No data yet!</p>
              <p>Keep practicing and your progress will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Grammar breakdown card
function GrammarCard({ breakdown }: { breakdown: GrammarBreakdown }) {
  const accuracyColor = breakdown.accuracy >= 80 ? '#22c55e' :
                        breakdown.accuracy >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={styles.breakdownCard}>
      <div style={styles.breakdownHeader}>
        <span style={styles.breakdownTitle}>{breakdown.feature}</span>
        <span style={{ ...styles.accuracyBadge, backgroundColor: accuracyColor }}>
          {breakdown.accuracy}%
        </span>
      </div>
      <div style={styles.breakdownStats}>
        <span style={{ color: '#22c55e' }}>{breakdown.correct} correct</span>
        <span style={{ color: '#999' }}> / </span>
        <span style={{ color: '#ef4444' }}>{breakdown.incorrect} incorrect</span>
      </div>
      {breakdown.mistakes.length > 0 && (
        <div style={styles.mistakesSection}>
          <p style={styles.mistakesLabel}>Common mistakes:</p>
          {breakdown.mistakes.map((m, i) => (
            <div key={i} style={styles.mistakeItem}>
              <span style={styles.mistakeWrong}>{m.student}</span>
              <span style={styles.mistakeArrow}> should be </span>
              <span style={styles.mistakeCorrect}>{m.correct}</span>
              {m.count > 1 && <span style={styles.mistakeCount}>x{m.count}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Vocabulary breakdown card
function VocabularyCard({ breakdown }: { breakdown: TranslationBreakdown }) {
  const accuracyColor = breakdown.accuracy >= 80 ? '#22c55e' :
                        breakdown.accuracy >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={styles.breakdownCard}>
      <div style={styles.breakdownHeader}>
        <span style={styles.breakdownTitle}>Word Translations</span>
        <span style={{ ...styles.accuracyBadge, backgroundColor: accuracyColor }}>
          {breakdown.accuracy}%
        </span>
      </div>
      <div style={styles.breakdownStats}>
        <span style={{ color: '#22c55e' }}>{breakdown.correct} correct</span>
        <span style={{ color: '#999' }}> / </span>
        <span style={{ color: '#ef4444' }}>{breakdown.incorrect} incorrect</span>
      </div>

      {/* Struggling Words */}
      {breakdown.strugglingWords.length > 0 && (
        <div style={styles.wordSection}>
          <p style={{ ...styles.wordSectionTitle, color: '#ef4444' }}>Words to Review:</p>
          {breakdown.strugglingWords.map((word, i) => (
            <div key={i} style={styles.wordItem}>
              <span style={styles.arabicWord}>{word.arabic_text || `Word #${word.word_id}`}</span>
              <span style={styles.wordMeaning}>= "{word.correct_answer}"</span>
              {word.count > 1 && <span style={styles.wordCount}>missed x{word.count}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Mastered Words */}
      {breakdown.masteredWords.length > 0 && (
        <div style={styles.wordSection}>
          <p style={{ ...styles.wordSectionTitle, color: '#22c55e' }}>Words You Know:</p>
          <div style={styles.masteredWordsGrid}>
            {breakdown.masteredWords.map((word, i) => (
              <span key={i} style={styles.masteredWord}>
                {word.arabic_text || `Word #${word.word_id}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const styles: { [key: string]: React.CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: '#fff',
    borderRadius: '16px',
    maxWidth: '650px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  closeX: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.1)',
    border: 'none',
    borderRadius: '50%',
    width: '32px',
    height: '32px',
    fontSize: '18px',
    cursor: 'pointer',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    padding: '2rem',
    textAlign: 'center',
    borderRadius: '16px 16px 0 0',
  },
  scoreCircle: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: '#fff',
    margin: '0 auto 1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
  },
  scoreNumber: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: '0.75rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  motivationalMessage: {
    fontSize: '1rem',
    color: '#333',
    marginBottom: '1rem',
    fontWeight: 500,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1.5rem',
    flexWrap: 'wrap',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#666',
    textTransform: 'uppercase',
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  summaryCard: {
    padding: '1rem',
    borderRadius: '12px',
    border: '2px solid',
    background: '#fafafa',
  },
  summaryTitle: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
    marginBottom: '0.5rem',
  },
  summaryItem: {
    fontSize: '0.85rem',
    color: '#444',
    marginBottom: '0.25rem',
    paddingLeft: '0.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
  },
  breakdownCard: {
    padding: '1rem',
    background: '#f8f9fa',
    borderRadius: '12px',
    marginBottom: '0.75rem',
  },
  breakdownHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  breakdownTitle: {
    fontWeight: 600,
    color: '#333',
    fontSize: '1rem',
  },
  accuracyBadge: {
    color: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  breakdownStats: {
    fontSize: '0.85rem',
    marginBottom: '0.75rem',
  },
  mistakesSection: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #e5e7eb',
  },
  mistakesLabel: {
    fontSize: '0.8rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  mistakeItem: {
    fontSize: '0.85rem',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    flexWrap: 'wrap',
  },
  mistakeWrong: {
    color: '#ef4444',
    textDecoration: 'line-through',
  },
  mistakeArrow: {
    color: '#999',
    fontSize: '0.75rem',
  },
  mistakeCorrect: {
    color: '#22c55e',
    fontWeight: 500,
  },
  mistakeCount: {
    color: '#999',
    fontSize: '0.75rem',
    marginLeft: '0.25rem',
  },
  wordSection: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #e5e7eb',
  },
  wordSectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  wordItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    flexWrap: 'wrap',
  },
  arabicWord: {
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    fontSize: '1.2rem',
    color: '#333',
  },
  wordMeaning: {
    fontSize: '0.85rem',
    color: '#666',
  },
  wordCount: {
    fontSize: '0.75rem',
    color: '#ef4444',
    background: '#fee2e2',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
  },
  masteredWordsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  masteredWord: {
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    fontSize: '1rem',
    background: '#dcfce7',
    color: '#166534',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '3rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #e5e7eb',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1rem',
    color: '#666',
  },
  errorTitle: {
    textAlign: 'center',
    color: '#ef4444',
    marginBottom: '0.5rem',
  },
  errorText: {
    textAlign: 'center',
    color: '#666',
    marginBottom: '1rem',
  },
  closeButton: {
    display: 'block',
    margin: '0 auto',
    padding: '0.5rem 1.5rem',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666',
  },
};

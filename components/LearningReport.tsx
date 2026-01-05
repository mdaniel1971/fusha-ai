'use client';

import { useState, useEffect } from 'react';
import type { LearningReport, SkillBreakdown, PatternInsight, Breakthrough, StudyRecommendation } from '@/lib/reportGenerator';

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
              <span style={styles.statLabel}>exchanges</span>
            </div>
          </div>
        </div>

        <div style={styles.scrollContainer}>
          {/* Breakthroughs Section */}
          {report.breakthroughs.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#f59e0b' }}>
                Breakthrough Moments
              </h3>
              {report.breakthroughs.map((b, i) => (
                <BreakthroughCard key={i} breakthrough={b} />
              ))}
            </section>
          )}

          {/* Strengths Section */}
          {report.strengths.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#22c55e' }}>
                Your Strengths
              </h3>
              {report.strengths.map((category, i) => (
                <SkillCategoryCard key={i} category={category} type="strength" />
              ))}
            </section>
          )}

          {/* Growth Areas Section */}
          {report.weaknesses.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#f97316' }}>
                Growth Opportunities
              </h3>
              {report.weaknesses.map((category, i) => (
                <SkillCategoryCard key={i} category={category} type="weakness" />
              ))}
            </section>
          )}

          {/* Patterns Section */}
          {report.patterns.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#8b5cf6' }}>
                Patterns Detected
              </h3>
              {report.patterns.map((pattern, i) => (
                <PatternCard key={i} pattern={pattern} />
              ))}
            </section>
          )}

          {/* Recommendations Section */}
          {report.recommendations.length > 0 && (
            <section style={styles.section}>
              <h3 style={{ ...styles.sectionTitle, color: '#3b82f6' }}>
                Your Study Plan
              </h3>
              {report.recommendations.map((rec, i) => (
                <RecommendationCard key={i} recommendation={rec} />
              ))}
            </section>
          )}

          {/* Empty State */}
          {report.strengths.length === 0 && report.weaknesses.length === 0 && (
            <div style={styles.emptyState}>
              <p>Keep practicing! More insights will appear as you learn.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components
function BreakthroughCard({ breakthrough }: { breakthrough: Breakthrough }) {
  return (
    <div style={styles.breakthroughCard}>
      <span style={styles.breakthroughIcon}>&#9889;</span>
      <div>
        <p style={styles.breakthroughMoment}>{breakthrough.moment}</p>
        <p style={styles.breakthroughContext}>{breakthrough.context}</p>
      </div>
    </div>
  );
}

function SkillCategoryCard({ category, type }: { category: SkillBreakdown; type: 'strength' | 'weakness' }) {
  const bgColor = type === 'strength' ? '#22c55e11' : '#f9731611';
  const borderColor = type === 'strength' ? '#22c55e33' : '#f9731633';

  return (
    <div style={{ ...styles.categoryCard, background: bgColor, borderColor }}>
      <h4 style={styles.categoryTitle}>{category.category}</h4>
      <div style={styles.skillsContainer}>
        {category.skills.map((skill, i) => (
          <div key={i} style={styles.skillBadge}>
            <span style={styles.skillName}>{skill.name}</span>
            {skill.frequency > 1 && (
              <span style={styles.skillCount}>x{skill.frequency}</span>
            )}
          </div>
        ))}
      </div>
      {category.skills[0]?.examples[0] && (
        <p style={styles.exampleText}>
          Example: <span style={styles.arabicExample}>{category.skills[0].examples[0]}</span>
        </p>
      )}
    </div>
  );
}

function PatternCard({ pattern }: { pattern: PatternInsight }) {
  const impactColors = {
    high: { bg: '#ef444422', border: '#ef444444', text: '#ef4444' },
    medium: { bg: '#f59e0b22', border: '#f59e0b44', text: '#f59e0b' },
    low: { bg: '#22c55e22', border: '#22c55e44', text: '#22c55e' },
  };
  const colors = impactColors[pattern.impact];

  return (
    <div style={{ ...styles.patternCard, background: colors.bg, borderColor: colors.border }}>
      <div style={styles.patternHeader}>
        <span style={styles.patternName}>{pattern.pattern}</span>
        <span style={{ ...styles.impactBadge, background: colors.text }}>{pattern.impact}</span>
      </div>
      <p style={styles.patternExplanation}>{pattern.explanation}</p>
      <span style={styles.patternFrequency}>Observed {pattern.frequency}x</span>
    </div>
  );
}

function RecommendationCard({ recommendation }: { recommendation: StudyRecommendation }) {
  return (
    <div style={styles.recommendationCard}>
      <div style={styles.recommendationHeader}>
        <span style={styles.priorityBadge}>#{recommendation.priority}</span>
        <span style={styles.recommendationTime}>{recommendation.estimatedTime}</span>
      </div>
      <h4 style={styles.recommendationTitle}>{recommendation.skillArea}</h4>
      <p style={styles.recommendationFocus}>{recommendation.specificFocus}</p>
      <div style={styles.practicePrompt}>
        <span style={styles.practiceIcon}>&#128218;</span>
        <p style={styles.practiceText}>{recommendation.practicePrompt}</p>
      </div>
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
    maxWidth: '600px',
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
    width: '120px',
    height: '120px',
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
    fontSize: '3rem',
    fontWeight: 'bold',
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: '0.875rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  motivationalMessage: {
    fontSize: '1.125rem',
    color: '#333',
    marginBottom: '1rem',
    fontWeight: 500,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '2rem',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#666',
    textTransform: 'uppercase',
  },
  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '1.5rem',
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  breakthroughCard: {
    display: 'flex',
    gap: '0.75rem',
    padding: '1rem',
    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    borderRadius: '12px',
    marginBottom: '0.5rem',
  },
  breakthroughIcon: {
    fontSize: '1.5rem',
  },
  breakthroughMoment: {
    fontWeight: 600,
    color: '#92400e',
    marginBottom: '0.25rem',
  },
  breakthroughContext: {
    fontSize: '0.875rem',
    color: '#b45309',
  },
  categoryCard: {
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '0.5rem',
  },
  categoryTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#333',
    marginBottom: '0.5rem',
  },
  skillsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  skillBadge: {
    background: '#fff',
    padding: '0.25rem 0.75rem',
    borderRadius: '999px',
    fontSize: '0.8rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    border: '1px solid #e5e7eb',
  },
  skillName: {
    color: '#374151',
  },
  skillCount: {
    background: '#e5e7eb',
    padding: '0 0.375rem',
    borderRadius: '999px',
    fontSize: '0.7rem',
    color: '#6b7280',
  },
  exampleText: {
    marginTop: '0.75rem',
    fontSize: '0.8rem',
    color: '#666',
  },
  arabicExample: {
    fontFamily: "'Amiri', 'Traditional Arabic', serif",
    fontSize: '1.1em',
    color: '#333',
  },
  patternCard: {
    padding: '1rem',
    borderRadius: '12px',
    border: '1px solid',
    marginBottom: '0.5rem',
  },
  patternHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  patternName: {
    fontWeight: 600,
    color: '#333',
  },
  impactBadge: {
    color: '#fff',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  patternExplanation: {
    fontSize: '0.875rem',
    color: '#555',
    marginBottom: '0.5rem',
  },
  patternFrequency: {
    fontSize: '0.75rem',
    color: '#888',
  },
  recommendationCard: {
    padding: '1rem',
    background: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    marginBottom: '0.75rem',
  },
  recommendationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
  },
  priorityBadge: {
    background: '#3b82f6',
    color: '#fff',
    padding: '0.125rem 0.5rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  recommendationTime: {
    fontSize: '0.75rem',
    color: '#64748b',
  },
  recommendationTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '0.25rem',
  },
  recommendationFocus: {
    fontSize: '0.875rem',
    color: '#475569',
    marginBottom: '0.75rem',
  },
  practicePrompt: {
    display: 'flex',
    gap: '0.5rem',
    padding: '0.75rem',
    background: '#fff',
    borderRadius: '8px',
    border: '1px dashed #cbd5e1',
  },
  practiceIcon: {
    fontSize: '1.25rem',
  },
  practiceText: {
    fontSize: '0.8rem',
    color: '#475569',
    lineHeight: 1.4,
    margin: 0,
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

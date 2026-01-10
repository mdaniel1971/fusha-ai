'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface GrammarStat {
  feature: string;
  mastered: number;
  emerging: number;
  struggling: number;
}

interface RecentObservation {
  id: number;
  grammar_feature: string;
  grammar_value: string;
  performance_level: 'mastered' | 'emerging' | 'struggling';
  student_attempt?: string;
  correct_form?: string;
  created_at: string;
}

export default function ProgressPage() {
  const [grammarStats, setGrammarStats] = useState<GrammarStat[]>([]);
  const [recentObservations, setRecentObservations] = useState<RecentObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fushaai_user_id') || '';
    }
    return '';
  });

  useEffect(() => {
    if (userId) {
      fetchProgress();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch observations
      const response = await fetch(`/api/observations/log-grammar?userId=${userId}&limit=100`);
      if (!response.ok) throw new Error('Failed to load progress');
      const data = await response.json();

      // Process observations into stats
      const observations = data.observations || [];
      setRecentObservations(observations.slice(0, 20));

      // Calculate stats per feature
      const statsMap = new Map<string, GrammarStat>();
      for (const obs of observations) {
        if (!statsMap.has(obs.grammar_feature)) {
          statsMap.set(obs.grammar_feature, {
            feature: obs.grammar_feature,
            mastered: 0,
            emerging: 0,
            struggling: 0,
          });
        }
        const stat = statsMap.get(obs.grammar_feature)!;
        stat[obs.performance_level as keyof Pick<GrammarStat, 'mastered' | 'emerging' | 'struggling'>]++;
      }

      setGrammarStats(Array.from(statsMap.values()).sort((a, b) => {
        // Sort by total observations descending
        const totalA = a.mastered + a.emerging + a.struggling;
        const totalB = b.mastered + b.emerging + b.struggling;
        return totalB - totalA;
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    } finally {
      setLoading(false);
    }
  };

  const formatFeature = (feature: string) => {
    return feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPerformanceColor = (level: string) => {
    switch (level) {
      case 'mastered': return '#22c55e';
      case 'emerging': return '#f59e0b';
      case 'struggling': return '#ef4444';
      default: return '#666';
    }
  };

  const getMasteryPercentage = (stat: GrammarStat) => {
    const total = stat.mastered + stat.emerging + stat.struggling;
    if (total === 0) return 0;
    return Math.round((stat.mastered / total) * 100);
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
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Loading progress...</p>
      </div>
    );
  }

  if (!userId) {
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
          No Progress Yet
        </h1>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666', marginBottom: '2rem', maxWidth: '400px' }}>
          Start a lesson to begin tracking your grammar progress.
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
          Start Learning
        </Link>
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
          onClick={fetchProgress}
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

  const totalObservations = grammarStats.reduce((sum, s) => sum + s.mastered + s.emerging + s.struggling, 0);
  const totalMastered = grammarStats.reduce((sum, s) => sum + s.mastered, 0);
  const overallMastery = totalObservations > 0 ? Math.round((totalMastered / totalObservations) * 100) : 0;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f5f5f5',
      padding: '1rem',
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '800px',
        margin: '0 auto 1.5rem',
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
        <h1 style={{
          fontFamily: 'Arial, sans-serif',
          fontSize: '1.25rem',
          color: '#333',
          margin: 0,
        }}>
          Grammar Progress
        </h1>
        <Link
          href="/drills"
          style={{
            fontFamily: 'Arial, sans-serif',
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.9rem',
          }}
        >
          Practice →
        </Link>
      </div>

      {grammarStats.length === 0 ? (
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          backgroundColor: '#fff',
          borderRadius: '16px',
          padding: '3rem 2rem',
          textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: 'Arial, sans-serif', color: '#333', marginBottom: '1rem' }}>
            No Data Yet
          </h2>
          <p style={{ fontFamily: 'Arial, sans-serif', color: '#666', marginBottom: '2rem' }}>
            Complete some lessons to see your grammar progress here.
          </p>
          <Link
            href="/lesson"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontFamily: 'Arial, sans-serif',
              backgroundColor: '#3b82f6',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
            }}
          >
            Start a Lesson
          </Link>
        </div>
      ) : (
        <>
          {/* Overall stats */}
          <div style={{
            maxWidth: '800px',
            margin: '0 auto 1.5rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1rem',
          }}>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '2rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                color: '#3b82f6',
              }}>
                {overallMastery}%
              </div>
              <div style={{
                fontSize: '0.85rem',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
              }}>
                Overall Mastery
              </div>
            </div>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '2rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                color: '#22c55e',
              }}>
                {totalMastered}
              </div>
              <div style={{
                fontSize: '0.85rem',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
              }}>
                Items Mastered
              </div>
            </div>
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center',
            }}>
              <div style={{
                fontSize: '2rem',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                color: '#666',
              }}>
                {grammarStats.length}
              </div>
              <div style={{
                fontSize: '0.85rem',
                fontFamily: 'Arial, sans-serif',
                color: '#666',
              }}>
                Features Practiced
              </div>
            </div>
          </div>

          {/* Feature breakdown */}
          <div style={{
            maxWidth: '800px',
            margin: '0 auto 1.5rem',
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '1.5rem',
          }}>
            <h2 style={{
              fontFamily: 'Arial, sans-serif',
              fontSize: '1.1rem',
              color: '#333',
              margin: '0 0 1rem 0',
            }}>
              Grammar Features
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grammarStats.map((stat) => {
                const total = stat.mastered + stat.emerging + stat.struggling;
                const masteryPct = getMasteryPercentage(stat);

                return (
                  <div key={stat.feature}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.5rem',
                    }}>
                      <span style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '0.95rem',
                        color: '#333',
                      }}>
                        {formatFeature(stat.feature)}
                      </span>
                      <span style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '0.85rem',
                        color: '#666',
                      }}>
                        {masteryPct}% mastered
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div style={{
                      display: 'flex',
                      height: '8px',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      backgroundColor: '#e5e5e5',
                    }}>
                      <div style={{
                        width: `${(stat.mastered / total) * 100}%`,
                        backgroundColor: '#22c55e',
                      }} />
                      <div style={{
                        width: `${(stat.emerging / total) * 100}%`,
                        backgroundColor: '#f59e0b',
                      }} />
                      <div style={{
                        width: `${(stat.struggling / total) * 100}%`,
                        backgroundColor: '#ef4444',
                      }} />
                    </div>

                    {/* Counts */}
                    <div style={{
                      display: 'flex',
                      gap: '1rem',
                      marginTop: '0.25rem',
                      fontSize: '0.75rem',
                      fontFamily: 'Arial, sans-serif',
                      color: '#666',
                    }}>
                      <span style={{ color: '#22c55e' }}>{stat.mastered} mastered</span>
                      <span style={{ color: '#f59e0b' }}>{stat.emerging} emerging</span>
                      <span style={{ color: '#ef4444' }}>{stat.struggling} struggling</span>
                    </div>

                    {/* Practice link for struggling features */}
                    {stat.struggling > 0 && (
                      <Link
                        href={`/drills?feature=${stat.feature}`}
                        style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          fontSize: '0.8rem',
                          fontFamily: 'Arial, sans-serif',
                          color: '#3b82f6',
                          textDecoration: 'none',
                        }}
                      >
                        Practice this →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent observations */}
          {recentObservations.length > 0 && (
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              backgroundColor: '#fff',
              borderRadius: '16px',
              padding: '1.5rem',
            }}>
              <h2 style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '1.1rem',
                color: '#333',
                margin: '0 0 1rem 0',
              }}>
                Recent Activity
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentObservations.map((obs) => (
                  <div
                    key={obs.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '0.9rem',
                        color: '#333',
                      }}>
                        {formatFeature(obs.grammar_feature)}: {obs.grammar_value.replace(/_/g, ' ')}
                      </div>
                      {obs.student_attempt && (
                        <div style={{
                          fontFamily: "'Amiri', serif",
                          fontSize: '1rem',
                          color: '#666',
                          marginTop: '0.25rem',
                        }}>
                          {obs.student_attempt}
                          {obs.correct_form && obs.student_attempt !== obs.correct_form && (
                            <span style={{ color: '#22c55e', marginLeft: '0.5rem' }}>
                              → {obs.correct_form}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '0.25rem',
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        backgroundColor: `${getPerformanceColor(obs.performance_level)}20`,
                        color: getPerformanceColor(obs.performance_level),
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontFamily: 'Arial, sans-serif',
                        fontWeight: 'bold',
                      }}>
                        {obs.performance_level}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        fontFamily: 'Arial, sans-serif',
                        color: '#999',
                      }}>
                        {formatDate(obs.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{
            maxWidth: '800px',
            margin: '1.5rem auto 0',
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            fontSize: '0.8rem',
            fontFamily: 'Arial, sans-serif',
            color: '#666',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#22c55e' }} />
              <span>Mastered</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
              <span>Emerging</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
              <span>Struggling</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

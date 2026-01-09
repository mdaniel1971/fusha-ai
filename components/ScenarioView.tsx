'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ScenarioWord {
  id: number;
  wordId: number;
  sceneNumber: number | null;
  position: { top: string; left: string } | null;
  arabic: string;
  transliteration: string;
  english: string;
  partOfSpeech: string;
}

interface Scenario {
  id: number;
  title: string;
  titleArabic: string;
  description: string;
  sceneCount: number;
  words: ScenarioWord[];
}

interface ScenarioViewProps {
  scenarioId?: number;
  editMode?: boolean;
}

export default function ScenarioView({ scenarioId = 1, editMode = false }: ScenarioViewProps) {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentScene, setCurrentScene] = useState(1);
  const [activeWord, setActiveWord] = useState<ScenarioWord | null>(null);
  const [draggedWord, setDraggedWord] = useState<ScenarioWord | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchScenario();
  }, [scenarioId]);

  // Refresh data when exiting edit mode to get saved positions
  useEffect(() => {
    if (!editMode) {
      fetchScenario();
    }
  }, [editMode]);

  const fetchScenario = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/scenario/${scenarioId}`);
      if (!response.ok) throw new Error('Failed to load scenario');
      const data = await response.json();
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenario');
    } finally {
      setLoading(false);
    }
  };

  // Words placed on current scene
  const placedWords = scenario?.words.filter(w => w.sceneNumber === currentScene) || [];

  // Words not yet placed on any scene
  const unplacedWords = scenario?.words.filter(w => w.sceneNumber === null) || [];

  const handleWordClick = (word: ScenarioWord) => {
    if (!editMode) {
      setActiveWord(activeWord?.id === word.id ? null : word);
    }
  };

  const handleSceneClick = () => {
    if (!editMode) {
      setActiveWord(null);
    }
  };

  // Start dragging from word bank
  const handleDragStart = (word: ScenarioWord, e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    setDraggedWord(word);
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggedWord) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
  }, [draggedWord]);

  // Handle drop
  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!draggedWord || !sceneRef.current || !scenario) {
      setDraggedWord(null);
      setDragPosition(null);
      return;
    }

    const rect = sceneRef.current.getBoundingClientRect();
    const isOverScene =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;

    if (isOverScene) {
      // Calculate position as percentage
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const clampedX = Math.max(5, Math.min(95, x));
      const clampedY = Math.max(5, Math.min(95, y));

      // Update local state immediately
      setScenario({
        ...scenario,
        words: scenario.words.map(w =>
          w.id === draggedWord.id
            ? { ...w, sceneNumber: currentScene, position: { top: `${clampedY}%`, left: `${clampedX}%` } }
            : w
        ),
      });

      // Save to database
      try {
        const response = await fetch(`/api/scenario/${scenarioId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wordId: draggedWord.id,
            sceneNumber: currentScene,
            position: { top: `${clampedY}%`, left: `${clampedX}%` },
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          console.error('Save failed:', result.error);
        } else {
          console.log('Word placement saved:', draggedWord.arabic, 'to scene', currentScene);
        }
      } catch (err) {
        console.error('Failed to save placement:', err);
      }
    }

    setDraggedWord(null);
    setDragPosition(null);
  }, [draggedWord, scenario, currentScene, scenarioId]);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (editMode && draggedWord) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [editMode, draggedWord, handleMouseMove, handleMouseUp]);

  // Handle dragging placed words to reposition
  const handlePlacedWordDrag = (word: ScenarioWord, e: React.MouseEvent) => {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    setDraggedWord(word);
    setDragPosition({ x: e.clientX, y: e.clientY });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#666' }}>Loading scenario...</p>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <p style={{ fontFamily: 'Arial, sans-serif', color: '#c00' }}>{error || 'No scenario found'}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'Arial, sans-serif', color: '#333' }}>
            {scenario.title}
            {editMode && (
              <span style={{ color: '#3b82f6', marginLeft: '8px', fontSize: '0.8rem' }}>
                (Edit Mode)
              </span>
            )}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#666', fontFamily: 'Arial, sans-serif' }}>
            Scene {currentScene} of {scenario.sceneCount}
          </p>
        </div>

        {/* Scene navigation */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setCurrentScene(s => Math.max(1, s - 1))}
            disabled={currentScene === 1}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              backgroundColor: currentScene === 1 ? '#e5e5e5' : '#1a1a1a',
              color: currentScene === 1 ? '#999' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: currentScene === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: scenario.sceneCount }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => setCurrentScene(i + 1)}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: currentScene === i + 1 ? '#3b82f6' : '#ddd',
                  color: currentScene === i + 1 ? '#fff' : '#666',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentScene(s => Math.min(scenario.sceneCount, s + 1))}
            disabled={currentScene === scenario.sceneCount}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              backgroundColor: currentScene === scenario.sceneCount ? '#e5e5e5' : '#1a1a1a',
              color: currentScene === scenario.sceneCount ? '#999' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: currentScene === scenario.sceneCount ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Scene image */}
        <div
          ref={sceneRef}
          onClick={handleSceneClick}
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#e0e0e0',
            backgroundImage: `url(/scenes/scene${currentScene}.png)`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Placed words on this scene */}
          {placedWords.map((word) => (
            <div
              key={word.id}
              onMouseDown={(e) => editMode ? handlePlacedWordDrag(word, e) : undefined}
              onClick={(e) => { e.stopPropagation(); handleWordClick(word); }}
              style={{
                position: 'absolute',
                top: word.position?.top || '50%',
                left: word.position?.left || '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: activeWord?.id === word.id
                  ? 'rgba(59, 130, 246, 0.95)'
                  : 'rgba(255, 255, 255, 0.95)',
                border: `2px solid ${activeWord?.id === word.id ? '#2563eb' : '#3b82f6'}`,
                borderRadius: editMode ? '8px' : '50%',
                padding: editMode ? '8px 12px' : '10px',
                cursor: editMode ? 'grab' : 'pointer',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                zIndex: activeWord?.id === word.id ? 50 : 10,
                userSelect: 'none',
                minWidth: editMode ? '80px' : 'auto',
                textAlign: 'center',
              }}
            >
              {editMode ? (
                <>
                  <div style={{
                    fontFamily: "'Amiri', serif",
                    fontSize: '1.3rem',
                    lineHeight: 1.2,
                    color: '#1a1a1a',
                  }}>
                    {word.arabic}
                  </div>
                  <div style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '0.7rem',
                    color: '#666',
                    marginTop: '2px',
                  }}>
                    {word.english}
                  </div>
                </>
              ) : (
                <span style={{
                  fontSize: '1.2rem',
                  color: activeWord?.id === word.id ? '#fff' : '#3b82f6',
                  fontWeight: 'bold',
                }}>
                  +
                </span>
              )}
            </div>
          ))}

          {/* Popup for clicked word (view mode) */}
          {activeWord && !editMode && activeWord.sceneNumber === currentScene && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: activeWord.position?.top || '50%',
                left: activeWord.position?.left || '50%',
                transform: 'translate(-50%, calc(-100% - 60px))',
                backgroundColor: '#fff',
                borderRadius: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                padding: '16px 20px',
                minWidth: '200px',
                textAlign: 'center',
                zIndex: 100,
              }}
            >
              <div style={{
                position: 'absolute',
                bottom: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '10px solid #fff',
              }} />
              <div style={{
                fontFamily: "'Amiri', serif",
                fontSize: '2rem',
                lineHeight: 1.4,
                color: '#1a1a1a',
                marginBottom: '4px',
              }}>
                {activeWord.arabic}
              </div>
              <div style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '0.9rem',
                color: '#666',
                fontStyle: 'italic',
                marginBottom: '8px',
              }}>
                {activeWord.transliteration}
              </div>
              <div style={{
                fontFamily: 'Arial, sans-serif',
                fontSize: '1rem',
                color: '#333',
              }}>
                {activeWord.english}
              </div>
            </div>
          )}
        </div>

        {/* Word bank (edit mode only) */}
        {editMode && (
          <div style={{
            width: '200px',
            backgroundColor: '#fff',
            borderLeft: '1px solid #eee',
            padding: '12px',
            overflowY: 'auto',
          }}>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              color: '#333',
            }}>
              Words to Place ({unplacedWords.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unplacedWords.map((word) => (
                <div
                  key={word.id}
                  onMouseDown={(e) => handleDragStart(word, e)}
                  style={{
                    padding: '8px',
                    backgroundColor: '#f8f8f8',
                    border: '2px solid #ddd',
                    borderRadius: '6px',
                    cursor: 'grab',
                    userSelect: 'none',
                  }}
                >
                  <div style={{
                    fontFamily: "'Amiri', serif",
                    fontSize: '1.2rem',
                    color: '#1a1a1a',
                  }}>
                    {word.arabic}
                  </div>
                  <div style={{
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '0.75rem',
                    color: '#666',
                  }}>
                    {word.english}
                  </div>
                </div>
              ))}
              {unplacedWords.length === 0 && (
                <p style={{
                  fontSize: '0.8rem',
                  color: '#999',
                  fontFamily: 'Arial, sans-serif',
                  textAlign: 'center',
                  padding: '1rem',
                }}>
                  All words placed!
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Drag ghost */}
      {draggedWord && dragPosition && (
        <div
          style={{
            position: 'fixed',
            top: dragPosition.y,
            left: dragPosition.x,
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(34, 197, 94, 0.95)',
            border: '2px solid #16a34a',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontFamily: "'Amiri', serif",
            fontSize: '1.3rem',
            lineHeight: 1.2,
            color: '#fff',
          }}>
            {draggedWord.arabic}
          </div>
          <div style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.9)',
            marginTop: '2px',
          }}>
            {draggedWord.english}
          </div>
        </div>
      )}
    </div>
  );
}

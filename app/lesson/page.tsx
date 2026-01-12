'use client';

import { useState, useRef, useEffect } from 'react';
import LearningReport from '@/components/LearningReport';
import ScenarioView from '@/components/ScenarioView';

// ============================================================
// VOICE FEATURES - CURRENTLY DISABLED
// ============================================================
// Voice input (Whisper) and voice output (ElevenLabs) are commented out
// to focus on tutor content. To re-enable:
// 1. Uncomment the recording state variables below
// 2. Uncomment startRecording/stopRecording functions
// 3. Uncomment the recording button in the UI
// 4. Uncomment playAudio function and isPlaying state
// 5. Uncomment the useEffect that plays audio after response
// See README.md section "Re-enabling Voice Features" for details
// ============================================================

interface Message {
  role: 'user' | 'assistant';
  content: string;
  usage?: TokenUsage;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: string;
  outputCost: string;
  totalCost: string;
  model: string;
}

// ============================================================
// WHITEBOARD INTERFACE - COMMENTED OUT
// ============================================================
/*
interface WhiteboardContent {
  word?: string;
  transliteration?: string;
  meaning?: string;
  type?: 'vocabulary' | 'grammar' | 'correction' | 'practice';
  grammar?: string;
  root?: string;
  pattern?: string;
  conjugation?: Record<string, string>;
  yourAttempt?: string;
  correct?: string;
  prompt?: string;
}
*/
// ============================================================

// Format text to render Arabic in larger Amiri font, English in Arial
function formatWithArabic(text: string): React.ReactNode {
  const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g;
  
  const parts = text.split(arabicRegex);
  
  return parts.map((part, index) => {
    if (arabicRegex.test(part)) {
      arabicRegex.lastIndex = 0;
      return (
        <span 
          key={index} 
          style={{
            fontFamily: "'Amiri', 'Traditional Arabic', serif",
            fontSize: '1.4em',
            lineHeight: 1.5,
          }}
        >
          {part}
        </span>
      );
    }
    return (
      <span 
        key={index}
        style={{
          fontFamily: "Arial, sans-serif",
        }}
      >
        {part}
      </span>
    );
  });
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    name: 'Haiku',
    description: 'Fast and efficient, best for quick responses',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Sonnet',
    description: 'Balanced performance and quality',
  },
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Opus',
    description: 'Most capable, best for complex teaching',
  },
];

type LessonMode = 'traditional' | 'scenario';

export default function LessonPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<{ id: number; name: string } | null>(null);
  const [selectedLearningMode, setSelectedLearningMode] = useState<'grammar' | 'translation' | 'mix' | null>(null);
  const [lessonStarted, setLessonStarted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelChosen, setModelChosen] = useState(false);
  const [totalSessionCost, setTotalSessionCost] = useState(0);
  const [lastUsage, setLastUsage] = useState<TokenUsage | null>(null);
  const [lessonMode, setLessonMode] = useState<LessonMode | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [scenarioEditMode, setScenarioEditMode] = useState(false);
  const [availableScenarios, setAvailableScenarios] = useState<Array<{id: number; title: string; setup_arabic: string; setup_english: string}>>([]);

  // ============================================================
  // WHITEBOARD STATE - COMMENTED OUT
  // ============================================================
  // const [whiteboard, setWhiteboard] = useState<WhiteboardContent | null>(null);
  // ============================================================

  // ============================================================
  // VOICE STATE - COMMENTED OUT
  // ============================================================
  // const [isRecording, setIsRecording] = useState(false);
  // const [isPlaying, setIsPlaying] = useState(false);
  // const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // const chunksRef = useRef<Blob[]>([]);
  // const audioRef = useRef<HTMLAudioElement | null>(null);
  // ============================================================
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Fetch available scenarios when scenario mode is selected
  useEffect(() => {
    if (lessonMode === 'scenario' && availableScenarios.length === 0) {
      fetch('/api/scenarios')
        .then(res => res.json())
        .then(data => {
          if (data.scenarios) {
            setAvailableScenarios(data.scenarios);
          }
        })
        .catch(err => console.error('Failed to fetch scenarios:', err));
    }
  }, [lessonMode, availableScenarios.length]);

  // Inject CSS for contentEditable styling and animations (client-side only to avoid hydration mismatch)
  useEffect(() => {
    const styleId = 'arabic-input-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #999;
          pointer-events: none;
        }
        [contenteditable]:focus {
          outline: 2px solid #007bff;
          border-color: transparent !important;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);


  // Sync inputText state with contentEditable div and apply Arabic styling
  const handleInputChange = () => {
    if (!inputRef.current) return;

    const input = inputRef.current;
    const text = input.textContent || '';
    setInputText(text);

    // Apply Arabic styling
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g;
    if (arabicRegex.test(text)) {
      // Save cursor position
      const selection = window.getSelection();
      let cursorPosition = 0;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(input);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorPosition = preCaretRange.toString().length;
      }

      // Rebuild with styled spans
      arabicRegex.lastIndex = 0;
      const parts = text.split(arabicRegex);
      input.innerHTML = parts.map(part => {
        arabicRegex.lastIndex = 0;
        if (arabicRegex.test(part)) {
          return `<span style="font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 1.4em; line-height: 1.5;">${part}</span>`;
        }
        return part;
      }).join('');

      // Restore cursor position
      if (selection) {
        let charCount = 0;
        const nodeIterator = document.createNodeIterator(input, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = nodeIterator.nextNode())) {
          const nodeLength = node.textContent?.length || 0;
          if (charCount + nodeLength >= cursorPosition) {
            const newRange = document.createRange();
            newRange.setStart(node, cursorPosition - charCount);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            break;
          }
          charCount += nodeLength;
        }
      }
    }
  };

  // Clear the contentEditable div after sending
  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
    setInputText('');
  };

  // Available surahs - start with just Al-Fatiha for testing
  const availableSurahs = [
    { id: 1, name: 'Al-Fatiha', arabicName: 'الفاتحة', verseCount: 7, description: 'The Opening - foundation of Islamic prayer' },
  ];

  // Learning mode options
  const learningModes = [
    { id: 'grammar' as const, name: 'Grammar', description: 'Focus on parts of speech, grammatical cases, and verb forms' },
    { id: 'translation' as const, name: 'Translation', description: 'Focus on word meanings and translations' },
    { id: 'mix' as const, name: 'Mixed', description: 'Alternate between grammar and translation questions' },
  ];

  // Helper to create session record in database
  const createSessionRecord = async (sessionId: string, surahId = 1) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, surah_id: surahId }),
      });
      if (!res.ok) {
        console.warn('Failed to create session record:', await res.text());
      }
    } catch (err) {
      console.warn('Error creating session:', err);
    }
  };

  const startLesson = async (surah: { id: number; name: string }, learningMode: 'grammar' | 'translation' | 'mix') => {
    // Generate a unique session ID for tracking observations
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setSelectedSurah(surah);
    setSelectedLearningMode(learningMode);
    setLessonStarted(true);
    setIsLoading(true);
    setError(null);

    try {
      // Create session record in database first
      await createSessionRecord(newSessionId, surah.id);

      await streamChat([{
        role: 'user',
        content: `Start a lesson on ${surah.name}.`
      }], true, surah.id, learningMode, newSessionId);
    } catch (err) {
      console.error('Failed to start lesson:', err);
      setError('Failed to start lesson. Check console for details.');
    }
    setIsLoading(false);
  };

  // ============================================================
  // WHITEBOARD PARSING - COMMENTED OUT
  // ============================================================
  /*
  const parseWhiteboardContent = (text: string): { whiteboard: WhiteboardContent | null; speech: string } => {
    const whiteboardMatch = text.match(/\[WHITEBOARD\]([\s\S]*?)\[\/WHITEBOARD\]/);
    
    if (!whiteboardMatch) {
      return { whiteboard: null, speech: text };
    }
    
    const whiteboardText = whiteboardMatch[1];
    const speech = text.replace(/\[WHITEBOARD\][\s\S]*?\[\/WHITEBOARD\]/, '').trim();
    
    const content: WhiteboardContent = {};
    const lines = whiteboardText.trim().split('\n');
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length) {
        const value = valueParts.join(':').trim();
        const keyLower = key.trim().toLowerCase();
        
        if (keyLower === 'word') content.word = value;
        else if (keyLower === 'transliteration') content.transliteration = value;
        else if (keyLower === 'meaning') content.meaning = value;
        else if (keyLower === 'type') content.type = value as WhiteboardContent['type'];
        else if (keyLower === 'grammar') content.grammar = value;
        else if (keyLower === 'root') content.root = value;
        else if (keyLower === 'pattern') content.pattern = value;
        else if (keyLower === 'your attempt' || keyLower === 'yourattempt') content.yourAttempt = value;
        else if (keyLower === 'correct') content.correct = value;
        else if (keyLower === 'prompt') content.prompt = value;
      }
    }
    
    return { whiteboard: content, speech };
  };
  */
  // ============================================================

  const streamChat = async (chatMessages: Message[], isSystemMessage = false, surahId?: number, learningMode?: 'grammar' | 'translation' | 'mix', overrideSessionId?: string) => {
    setStreamingText('');
    setError(null);

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          surahId: surahId || selectedSurah?.id || 1,
          learningMode: learningMode || selectedLearningMode || 'mix',
          sessionId: overrideSessionId || sessionId,
          model: selectedModel,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let fullText = '';
      let usageData: TokenUsage | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                setStreamingText(fullText);

                // ============================================================
                // WHITEBOARD PARSING IN STREAM - COMMENTED OUT
                // ============================================================
                // const { whiteboard: wb, speech } = parseWhiteboardContent(fullText);
                // if (wb && Object.keys(wb).length > 0) {
                //   setWhiteboard(wb);
                // }
                // setStreamingText(speech);
                // ============================================================
              }
              if (parsed.usage) {
                usageData = parsed.usage;
                setLastUsage(usageData);
                setTotalSessionCost(prev => prev + parseFloat(parsed.usage.totalCost));
              }
              if (parsed.error) {
                console.error('Stream error:', parsed.error);
                setError(parsed.error);
              }
            } catch {
              // Partial JSON, ignore
            }
          }
        }
      }

      // ============================================================
      // WHITEBOARD FINAL PARSE - COMMENTED OUT
      // ============================================================
      // const { whiteboard: finalWb, speech: finalSpeech } = parseWhiteboardContent(fullText);
      // if (finalWb) setWhiteboard(finalWb);
      // ============================================================

      if (fullText) {
        const newMessage: Message = { role: 'assistant', content: fullText, usage: usageData || undefined };
        if (isSystemMessage) {
          setMessages([newMessage]);
        } else {
          setMessages(prev => [...prev, newMessage]);
        }
      }
      
      setStreamingText('');
      return fullText;
      
    } catch (err) {
      console.error('streamChat error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    }
  };

  // ============================================================
  // VOICE RECORDING FUNCTIONS - COMMENTED OUT
  // ============================================================
  /*
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await processAudio(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!transcribeRes.ok) throw new Error('Transcription failed');
      
      const { text: userText } = await transcribeRes.json();
      
      const userMessage: Message = { role: 'user', content: userText };
      setMessages(prev => [...prev, userMessage]);
      
      const allMessages = [...messages, userMessage];
      const speech = await streamChat(allMessages);
      
      await playAudio(speech);
      
    } catch (error) {
      console.error('Processing error:', error);
    }
    
    setIsLoading(false);
  };

  const playAudio = async (text: string) => {
    setIsPlaying(true);
    
    try {
      const response = await fetch('/api/speak-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) throw new Error('TTS failed');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
    }
  };
  */
  // ============================================================

  const handleSendText = async () => {
    if (!inputText.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    const userMessage: Message = { role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMessage]);
    clearInput();
    
    try {
      const allMessages = [...messages, userMessage];
      await streamChat(allMessages);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // ============================================================
  // WHITEBOARD RENDER FUNCTION - COMMENTED OUT
  // ============================================================
  /*
  const renderWhiteboard = () => {
    if (!whiteboard) return null;
    
    return (
      <div style={{
        backgroundColor: '#1a1a2e',
        color: '#fff',
        padding: '2rem',
        borderRadius: '12px',
        marginBottom: '1rem',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {whiteboard.word && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ 
              fontSize: '3rem', 
              fontFamily: "'Amiri', 'Traditional Arabic', serif",
              marginBottom: '0.5rem',
              direction: 'rtl',
            }}>
              {whiteboard.word}
            </div>
            {whiteboard.transliteration && (
              <div style={{ fontSize: '1.25rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
                {whiteboard.transliteration}
              </div>
            )}
            {whiteboard.meaning && (
              <div style={{ fontSize: '1.1rem', color: '#60a5fa' }}>
                "{whiteboard.meaning}"
              </div>
            )}
          </div>
        )}
        
        {(whiteboard.grammar || whiteboard.root || whiteboard.pattern) && (
          <div style={{ 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
          }}>
            {whiteboard.grammar && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Form: </span>
                <span style={{ color: '#fbbf24' }}>{whiteboard.grammar}</span>
              </div>
            )}
            {whiteboard.root && (
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#94a3b8' }}>Root: </span>
                <span style={{ fontFamily: "'Amiri', serif", fontSize: '1.2rem' }}>{whiteboard.root}</span>
              </div>
            )}
            {whiteboard.pattern && (
              <div>
                <span style={{ color: '#94a3b8' }}>Pattern: </span>
                <span style={{ fontFamily: "'Amiri', serif" }}>{whiteboard.pattern}</span>
              </div>
            )}
          </div>
        )}
        
        {whiteboard.type === 'correction' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
          }}>
            {whiteboard.yourAttempt && (
              <div style={{ 
                backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                padding: '1rem', 
                borderRadius: '8px',
                borderLeft: '3px solid #ef4444',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Your attempt
                </div>
                <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.2rem' }}>
                  {whiteboard.yourAttempt}
                </div>
              </div>
            )}
            {whiteboard.correct && (
              <div style={{ 
                backgroundColor: 'rgba(34, 197, 94, 0.2)', 
                padding: '1rem', 
                borderRadius: '8px',
                borderLeft: '3px solid #22c55e',
              }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Correct
                </div>
                <div style={{ fontFamily: "'Amiri', serif", fontSize: '1.2rem' }}>
                  {whiteboard.correct}
                </div>
              </div>
            )}
          </div>
        )}
        
        {whiteboard.prompt && (
          <div style={{
            backgroundColor: 'rgba(96, 165, 250, 0.2)',
            padding: '1rem',
            borderRadius: '8px',
            borderLeft: '3px solid #60a5fa',
            marginTop: '1rem',
          }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Practice
            </div>
            <div style={{ fontSize: '1.1rem' }}>
              {whiteboard.prompt}
            </div>
          </div>
        )}
      </div>
    );
  };
  */
  // ============================================================

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap"
        rel="stylesheet"
      />

      <main style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '1rem',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <h1 style={{
          textAlign: 'center',
          marginBottom: '1rem',
          fontSize: '1.5rem',
          color: '#1a1a1a',
          fontFamily: 'Arial, sans-serif',
        }}>
          FushaAI Lesson
        </h1>

        {/* Error display */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            marginBottom: '1rem',
            color: '#dc2626',
            fontFamily: 'Arial, sans-serif',
          }}>
            Error: {error}
          </div>
        )}

        {/* Model and Level selection screen */}
        {!lessonStarted ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '2rem',
            padding: '2rem',
          }}>
            {/* Model Selection */}
            {!modelChosen ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <h2 style={{
                  fontFamily: 'Arial, sans-serif',
                  marginBottom: '0.5rem',
                  color: '#333',
                }}>
                  Choose a model
                </h2>
                <p style={{
                  fontFamily: 'Arial, sans-serif',
                  color: '#666',
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  maxWidth: '400px',
                }}>
                  Select which Claude model to use for this lesson
                </p>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%',
                  maxWidth: '400px',
                }}>
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setModelChosen(true);
                      }}
                      style={{
                        padding: '1.25rem',
                        fontSize: '1rem',
                        fontFamily: 'Arial, sans-serif',
                        backgroundColor: '#fff',
                        border: '2px solid #ddd',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#ddd';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        {model.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        {model.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (lessonMode === null || lessonMode === 'traditional') && !selectedSurah ? (
              /* Surah Selection - shown directly after model selection */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  <button
                    onClick={() => setModelChosen(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: '1.5rem',
                      padding: '0.25rem',
                      lineHeight: 1,
                    }}
                  >
                    &#8592;
                  </button>
                  <h2 style={{
                    fontFamily: 'Arial, sans-serif',
                    margin: 0,
                    color: '#333',
                  }}>
                    Choose a Surah
                  </h2>
                </div>
                <p style={{
                  fontFamily: 'Arial, sans-serif',
                  color: '#666',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                  textAlign: 'center',
                }}>
                  Using {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}
                </p>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%',
                  maxWidth: '400px',
                }}>
                  {availableSurahs.map((surah) => (
                    <button
                      key={surah.id}
                      onClick={() => setSelectedSurah({ id: surah.id, name: surah.name })}
                      style={{
                        padding: '1.5rem',
                        fontSize: '1rem',
                        fontFamily: 'Arial, sans-serif',
                        backgroundColor: '#fff',
                        border: '2px solid #ddd',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#ddd';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{surah.name}</span>
                        <span style={{
                          fontFamily: "'Amiri', 'Traditional Arabic', serif",
                          fontSize: '1.3rem',
                          color: '#333',
                        }}>{surah.arabicName}</span>
                      </div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        {surah.description} ({surah.verseCount} verses)
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (lessonMode === null || lessonMode === 'traditional') && selectedSurah ? (
              /* Learning Mode Selection - shown after surah selection */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  <button
                    onClick={() => setSelectedSurah(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: '1.5rem',
                      padding: '0.25rem',
                      lineHeight: 1,
                    }}
                  >
                    &#8592;
                  </button>
                  <h2 style={{
                    fontFamily: 'Arial, sans-serif',
                    margin: 0,
                    color: '#333',
                  }}>
                    What do you want to practice?
                  </h2>
                </div>
                <p style={{
                  fontFamily: 'Arial, sans-serif',
                  color: '#666',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                  textAlign: 'center',
                }}>
                  <span style={{
                    fontFamily: "'Amiri', 'Traditional Arabic', serif",
                    fontSize: '1.2rem',
                  }}>{availableSurahs.find(s => s.id === selectedSurah.id)?.arabicName}</span>
                  {' '}{selectedSurah.name}
                </p>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%',
                  maxWidth: '400px',
                }}>
                  {learningModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => startLesson(selectedSurah, mode.id)}
                      style={{
                        padding: '1.5rem',
                        fontSize: '1rem',
                        fontFamily: 'Arial, sans-serif',
                        backgroundColor: '#fff',
                        border: '2px solid #ddd',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#3b82f6';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f0f7ff';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#ddd';
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff';
                      }}
                    >
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {mode.name}
                      </div>
                      <div style={{ color: '#666', fontSize: '0.9rem' }}>
                        {mode.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Scenario Selection */
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.5rem',
                }}>
                  <button
                    onClick={() => setLessonMode(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      cursor: 'pointer',
                      fontSize: '1.5rem',
                      padding: '0.25rem',
                      lineHeight: 1,
                    }}
                  >
                    &#8592;
                  </button>
                  <h2 style={{
                    fontFamily: 'Arial, sans-serif',
                    margin: 0,
                    color: '#333',
                  }}>
                    Choose a scenario
                  </h2>
                </div>
                <p style={{
                  fontFamily: 'Arial, sans-serif',
                  color: '#666',
                  fontSize: '0.9rem',
                  marginBottom: '0.5rem',
                }}>
                  Using {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}
                </p>
                {/* Edit mode toggle */}
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                  fontFamily: 'Arial, sans-serif',
                  color: '#666',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={scenarioEditMode}
                    onChange={(e) => setScenarioEditMode(e.target.checked)}
                  />
                  Edit mode (place hotspots)
                </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  width: '100%',
                  maxWidth: '450px',
                }}>
                  {availableScenarios.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#666', fontFamily: 'Arial, sans-serif' }}>
                      Loading scenarios...
                    </p>
                  ) : (
                    availableScenarios.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={async () => {
                          const newSessionId = crypto.randomUUID();
                          setSelectedScenarioId(scenario.id);
                          setSessionId(newSessionId);
                          await createSessionRecord(newSessionId, 1);
                          setLessonStarted(true);
                        }}
                        style={{
                          padding: '1.5rem',
                          fontSize: '1rem',
                          fontFamily: 'Arial, sans-serif',
                          backgroundColor: '#fff',
                          border: '2px solid #10b981',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#059669';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ecfdf5';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.borderColor = '#10b981';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold' }}>{scenario.title}</span>
                          <span style={{
                            fontFamily: "'Amiri', serif",
                            fontSize: '1.1rem',
                            color: '#333',
                          }}>{scenario.setup_arabic}</span>
                        </div>
                        <div style={{ color: '#666', fontSize: '0.9rem' }}>
                          {scenario.setup_english}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : selectedScenarioId ? (
          /* Scenario Mode */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ScenarioView
              scenarioId={selectedScenarioId}
              editMode={scenarioEditMode}
            />
            {/* Bottom bar for scenario mode */}
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fff',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f8f8f8',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#666',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
              }}>
                {scenarioEditMode && (
                  <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>EDIT MODE</span>
                )}
                <span>Scenario #{selectedScenarioId}</span>
              </div>
              <button
                onClick={() => {
                  setLessonStarted(false);
                  setSelectedScenarioId(null);
                  setLessonMode(null);
                  setTotalSessionCost(0);
                }}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontFamily: 'Arial, sans-serif',
                  backgroundColor: 'transparent',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                Exit Scenario
              </button>
            </div>
          </div>
        ) : (
          /* Traditional Lesson Mode */
          <>
            {/* Header with back button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem',
              padding: '0.5rem 0',
            }}>
              <button
                onClick={() => {
                  setLessonStarted(false);
                  setMessages([]);
                  setSelectedLearningMode(null);
                  setTotalSessionCost(0);
                  setSessionId(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  padding: '0.25rem',
                  lineHeight: 1,
                }}
              >
                &#8592;
              </button>
              <div>
                <span style={{
                  fontFamily: "'Amiri', 'Traditional Arabic', serif",
                  fontSize: '1.2rem',
                  marginRight: '0.5rem',
                }}>{availableSurahs.find(s => s.id === selectedSurah?.id)?.arabicName}</span>
                <span style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '0.9rem',
                  color: '#666',
                }}>
                  {selectedLearningMode === 'grammar' ? 'Grammar' : selectedLearningMode === 'translation' ? 'Translation' : 'Mixed'}
                </span>
              </div>
            </div>

            {/* ============================================================
                WHITEBOARD AREA - COMMENTED OUT
                ============================================================
            {renderWhiteboard()}
            ============================================================ */}

            {/* Chat messages */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '1rem',
            }}>
              {isLoading && messages.length === 0 && !streamingText && (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#666',
                  fontFamily: 'Arial, sans-serif',
                  padding: '2rem',
                }}>
                  Loading lesson...
                </div>
              )}
              
              {messages.map((message, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    borderRadius: '8px',
                    backgroundColor: message.role === 'user' ? '#e3f2fd' : '#fff',
                    border: message.role === 'user' ? 'none' : '1px solid #eee',
                    marginLeft: message.role === 'user' ? '2rem' : '0',
                    marginRight: message.role === 'user' ? '0' : '2rem',
                  }}
                >
                  <p style={{
                    margin: '0 0 0.5rem',
                    fontSize: '0.75rem',
                    color: '#666',
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                  }}>
                    {message.role === 'user' ? 'You' : 'Teacher'}
                  </p>
                  <p style={{
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {formatWithArabic(message.content)}
                  </p>
                  {/* Token usage display for assistant messages */}
                  {message.role === 'assistant' && message.usage && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f0f0f0',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontFamily: 'monospace',
                      color: '#666',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}>
                      <span>In: {message.usage.inputTokens} tok</span>
                      <span>Out: {message.usage.outputTokens} tok</span>
                      <span>Total: {message.usage.totalTokens} tok</span>
                      <span style={{ color: '#059669' }}>Cost: ${message.usage.totalCost}</span>
                    </div>
                  )}
                </div>
              ))}

              {streamingText && (
                <div
                  style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    borderRadius: '8px',
                    backgroundColor: '#fff',
                    border: '1px solid #eee',
                    marginRight: '2rem',
                  }}
                >
                  <p style={{ 
                    margin: '0 0 0.5rem', 
                    fontSize: '0.75rem', 
                    color: '#666',
                    fontWeight: 'bold',
                    fontFamily: 'Arial, sans-serif',
                  }}>
                    Teacher
                  </p>
                  <p style={{ 
                    margin: 0,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {formatWithArabic(streamingText)}
                    <span style={{ opacity: 0.5 }}>▊</span>
                  </p>
                </div>
              )}

              {/* ============================================================
                  VOICE PLAYING INDICATOR - COMMENTED OUT
                  ============================================================
              {isPlaying && !streamingText && (
                <div style={{ 
                  padding: '0.5rem 1rem',
                  color: '#666',
                  fontSize: '0.85rem',
                }}>
                  🔊 Speaking...
                </div>
              )}
              ============================================================ */}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Text input */}
            <div style={{
              padding: '1rem',
              borderTop: '1px solid #eee',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}>
              <div
                ref={inputRef}
                contentEditable={!isLoading}
                onInput={handleInputChange}
                onKeyDown={handleKeyDown}
                data-placeholder="Type your response..."
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  fontSize: '1rem',
                  fontFamily: "Arial, sans-serif",
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  outline: 'none',
                  minHeight: '1.5rem',
                  maxHeight: '6rem',
                  overflowY: 'auto',
                }}
              />
              <button
                onClick={handleSendText}
                disabled={isLoading || !inputText.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontFamily: "Arial, sans-serif",
                  backgroundColor: '#1a1a1a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (isLoading || !inputText.trim()) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || !inputText.trim()) ? 0.5 : 1,
                }}
              >
                {isLoading ? 'Thinking...' : 'Send'}
              </button>
            </div>

            {/* Report button and Session Cost */}
            <div style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}>
              {/* Session cost summary */}
              <div style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f8f8f8',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: '#666',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
              }}>
                <span>Model: <strong>{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}</strong></span>
                <span>Session: <strong style={{ color: '#059669' }}>${totalSessionCost.toFixed(4)}</strong></span>
              </div>

              <button
                onClick={() => setShowReport(true)}
                disabled={!sessionId || messages.length < 2}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontFamily: 'Arial, sans-serif',
                  backgroundColor: 'transparent',
                  color: messages.length >= 2 ? '#3b82f6' : '#999',
                  border: '1px solid',
                  borderColor: messages.length >= 2 ? '#3b82f6' : '#ddd',
                  borderRadius: '20px',
                  cursor: messages.length >= 2 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1rem' }}>&#10024;</span>
                Generate Learning Report
              </button>
            </div>

            {/* ============================================================
                VOICE RECORDING CONTROLS - COMMENTED OUT
                ============================================================
            <div style={{
              padding: '1rem',
              borderTop: '1px solid #eee',
              display: 'flex',
              justifyContent: 'center',
              gap: '1rem',
            }}>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isPlaying}
                style={{
                  padding: '1rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: isRecording ? '#dc2626' : '#1a1a1a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: (isLoading || isPlaying) ? 'not-allowed' : 'pointer',
                  opacity: (isLoading || isPlaying) ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isRecording ? '#fff' : '#dc2626',
                }} />
                {isRecording ? 'Stop' : 'Speak'}
              </button>
            </div>
            ============================================================ */}
          </>
        )}

        {/* Learning Report Modal */}
        {showReport && sessionId && (
          <LearningReport
            sessionId={sessionId}
            onClose={() => setShowReport(false)}
          />
        )}
      </main>
    </>
  );
}
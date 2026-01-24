'use client';

import { useState, useRef, useEffect } from 'react';
import LearningReport from '@/components/LearningReport';

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

export default function DiagnosticChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<{ id: number; name: string } | null>(null);
  const [chatStarted, setChatStarted] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('claude-haiku-4-5-20251001');
  const [modelChosen, setModelChosen] = useState(false);
  const [totalSessionCost, setTotalSessionCost] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Load model from sessionStorage on mount
  useEffect(() => {
    const storedModel = sessionStorage.getItem('selectedModel');
    if (storedModel) {
      setSelectedModel(storedModel);
    }
  }, []);

  // Inject CSS for contentEditable styling
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

  // Available surahs
  const availableSurahs = [
    { id: 1, name: 'Al-Fatiha', arabicName: 'الفاتحة', verseCount: 7, description: 'The Opening - foundation of Islamic prayer' },
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

  const startChat = async (surah: { id: number; name: string }) => {
    // Generate a unique session ID for tracking observations
    const newSessionId = crypto.randomUUID();
    setSessionId(newSessionId);
    setSelectedSurah(surah);
    setChatStarted(true);
    setIsLoading(true);
    setError(null);

    try {
      // Create session record in database first
      await createSessionRecord(newSessionId, surah.id);

      await streamChat([{
        role: 'user',
        content: `Start a diagnostic lesson on ${surah.name}.`
      }], true, surah.id, newSessionId);
    } catch (err) {
      console.error('Failed to start chat:', err);
      setError('Failed to start chat. Check console for details.');
    }
    setIsLoading(false);
  };

  const streamChat = async (chatMessages: Message[], isSystemMessage = false, surahId?: number, overrideSessionId?: string) => {
    setStreamingText('');
    setError(null);

    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          surahId: surahId || selectedSurah?.id || 1,
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
              }
              if (parsed.usage) {
                usageData = parsed.usage;
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
          FushaAI Diagnostic
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

        {/* Selection screens */}
        {!chatStarted ? (
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
                  Select which Claude model to use for this diagnostic
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
            ) : (
              /* Surah Selection - shown after model selection */
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
                      onClick={() => startChat({ id: surah.id, name: surah.name })}
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
            )}
          </div>
        ) : (
          /* Diagnostic Chat */
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
                  setChatStarted(false);
                  setMessages([]);
                  setTotalSessionCost(0);
                  setSessionId(null);
                  setSelectedSurah(null);
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
                  Diagnostic
                </span>
              </div>
            </div>

            {/* Chat area with tip sidebar */}
            <div style={{
              flex: 1,
              display: 'flex',
              gap: '1rem',
              minHeight: 0,
            }}>
              {/* Chat messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
              }}>
              {isLoading && messages.length === 0 && !streamingText && (
                <div style={{
                  textAlign: 'center',
                  color: '#666',
                  fontFamily: 'Arial, sans-serif',
                  padding: '2rem',
                }}>
                  Loading diagnostic...
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

              <div ref={messagesEndRef} />
              </div>

              {/* Tip sidebar */}
              <div style={{
                width: '200px',
                flexShrink: 0,
                backgroundColor: '#f0f7ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '1rem',
                alignSelf: 'flex-start',
                position: 'sticky',
                top: 0,
              }}>
                <p style={{
                  fontFamily: 'Arial, sans-serif',
                  color: '#1e40af',
                  fontSize: '0.8rem',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  <strong>Tip:</strong> Arabic answers can be in Arabic script or transliteration. Grammar terms can be in English or Arabic (e.g., nominative/marfu', genitive/majrur).
                </p>
              </div>
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

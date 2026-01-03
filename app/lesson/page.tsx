'use client';

import { useState, useRef, useEffect } from 'react';

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
}

// Format text to render Arabic in larger Amiri font
function formatWithArabic(text: string): React.ReactNode {
  // Regex to match Arabic text (including diacritics)
  const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g;
  
  const parts = text.split(arabicRegex);
  
  return parts.map((part, index) => {
    if (arabicRegex.test(part)) {
      // Reset regex lastIndex after test
      arabicRegex.lastIndex = 0;
      return (
        <span 
          key={index} 
          style={{ 
            fontFamily: "'Amiri', 'Traditional Arabic', serif",
            fontSize: '1.4em',
            lineHeight: 1.8,
          }}
        >
          {part}
        </span>
      );
    }
    return part;
  });
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

export default function LessonPage() {
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  // ============================================================
  // WHITEBOARD STATE - COMMENTED OUT
  // ============================================================
  // const [whiteboard, setWhiteboard] = useState<WhiteboardContent | null>(null);
  // ============================================================
  
  // Text input state (active)
  const [inputText, setInputText] = useState('');
  
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

  // Auto-scroll when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Start lesson on mount
  useEffect(() => {
    startLesson();
  }, []);

  const startLesson = async () => {
    setIsLoading(true);
    try {
      await streamChat([{ 
        role: 'user', 
        content: 'Start a new lesson. Greet me briefly and introduce today\'s vocabulary word.' 
      }], true);
    } catch (error) {
      console.error('Failed to start lesson:', error);
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
    
    // Parse the whiteboard content
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

  const streamChat = async (chatMessages: Message[], isSystemMessage = false) => {
    setStreamingText('');
    
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: chatMessages }),
    });

    if (!response.ok) throw new Error('Chat stream failed');

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let fullText = '';

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
          } catch {
            // Not JSON, might be partial
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
    
    // Add to messages
    if (!isSystemMessage) {
      setMessages(prev => [...prev, { role: 'assistant', content: fullText }]);
    } else {
      setMessages([{ role: 'assistant', content: fullText }]);
    }
    
    setStreamingText('');
    
    return fullText;
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
      // Transcribe
      const formData = new FormData();
      formData.append('audio', blob, 'audio.webm');
      
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!transcribeRes.ok) throw new Error('Transcription failed');
      
      const { text: userText } = await transcribeRes.json();
      
      // Add user message
      const userMessage: Message = { role: 'user', content: userText };
      setMessages(prev => [...prev, userMessage]);
      
      // Get AI response
      const allMessages = [...messages, userMessage];
      const speech = await streamChat(allMessages);
      
      // Play audio response
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

  // Text input handler (active while voice is disabled)
  const handleSendText = async () => {
    if (!inputText.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    
    try {
      const allMessages = [...messages, userMessage];
      await streamChat(allMessages);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
    
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
      }}>
        FushaAI Lesson
      </h1>

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
          </div>
        ))}

        {/* Streaming text display */}
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

      {/* Text input controls (active) */}
      <div style={{ 
        padding: '1rem',
        borderTop: '1px solid #eee',
        display: 'flex',
        gap: '0.5rem',
      }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your response..."
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            fontSize: '1.5rem',
            fontFamily: "'Amiri', 'Traditional Arabic', serif",
            border: '1px solid #ddd',
            borderRadius: '8px',
            outline: 'none',
            direction: 'auto',
          }}
        />
        <button
          onClick={handleSendText}
          disabled={isLoading || !inputText.trim()}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
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
    </main>
    </>
  );
}
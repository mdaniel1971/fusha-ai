'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function LessonPage() {
  // Conversation state
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Start the lesson - get initial greeting from FA
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startLesson();
    }
  }, []);

  // Speak text using ElevenLabs streaming
  async function speakText(text: string) {
    setIsPlaying(true);
    
    try {
      const response = await fetch('/api/speak-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('TTS request failed');
      }

      // Create a blob from the streamed response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Play the audio
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  }

  async function startLesson() {
    setIsLoading(true);
    setStreamingText('');
    
    try {
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: 'Hello, I am ready to start the lesson.',
          conversationHistory: [],
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullText += data.content;
                  setStreamingText(fullText);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Clean up error logs from display
      const cleanText = fullText.replace(/\[ERROR_LOG\][\s\S]*?\[\/ERROR_LOG\]/g, '').trim();
      setMessages([{ role: 'assistant', content: cleanText }]);
      setStreamingText('');
      
      // Speak the full response
      if (cleanText) {
        await speakText(cleanText);
      }
    } catch (error) {
      console.error('Failed to start lesson:', error);
    }
    setIsLoading(false);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please allow microphone access.');
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // When we have a new audio blob, process it
  useEffect(() => {
    if (audioBlob) {
      processAudio(audioBlob);
      setAudioBlob(null);
    }
  }, [audioBlob]);

  async function processAudio(blob: Blob) {
    setIsLoading(true);
    setStreamingText('');
    
    try {
      // Step 1: Transcribe audio
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      
      const transcribeResponse = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      const transcribeData = await transcribeResponse.json();
      
      if (transcribeData.error) {
        console.error('Transcription error:', transcribeData.error);
        setIsLoading(false);
        return;
      }
      
      const userText = transcribeData.text;
      
      // Add user message to conversation
      const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
      setMessages(newMessages);
      
      // Step 2: Stream from Claude
      const response = await fetch('/api/chat-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          conversationHistory: messages,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullText += data.content;
                  setStreamingText(fullText);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }

      // Clean up error logs from display
      const cleanText = fullText.replace(/\[ERROR_LOG\][\s\S]*?\[\/ERROR_LOG\]/g, '').trim();
      setMessages([...newMessages, { role: 'assistant', content: cleanText }]);
      setStreamingText('');
      
      // Speak the full response
      if (cleanText) {
        await speakText(cleanText);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
    
    setIsLoading(false);
  }

  return (
    <main style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '1rem',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ 
        padding: '1rem 0',
        borderBottom: '1px solid #eee',
        marginBottom: '1rem',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>FushaAI</h1>
        <p style={{ margin: '0.5rem 0 0', color: '#666', fontSize: '0.9rem' }}>
          Lesson: Al-Fatiha - Asking for Help
        </p>
      </div>

      {/* Conversation area */}
      <div style={{ 
        flex: 1,
        overflowY: 'auto',
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderRadius: '8px',
      }}>
        {messages.length === 0 && !streamingText && isLoading && (
          <p style={{ color: '#666', textAlign: 'center' }}>Starting lesson...</p>
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
            }}>
              {message.role === 'user' ? 'You' : 'Ustadh'}
            </p>
            <p style={{ 
              margin: 0,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {message.content}
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
              Ustadh
            </p>
            <p style={{ 
              margin: 0,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {streamingText.replace(/\[ERROR_LOG\][\s\S]*?\[\/ERROR_LOG\]/g, '')}
              <span style={{ opacity: 0.5 }}>▊</span>
            </p>
          </div>
        )}
        
        {isPlaying && !streamingText && (
          <div style={{ 
            padding: '0.5rem 1rem',
            color: '#666',
            fontSize: '0.85rem',
          }}>
            🔊 Speaking...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Recording controls */}
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
    </main>
  );
}
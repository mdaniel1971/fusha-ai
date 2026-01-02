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
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Audio playback
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Refs for auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

// Start the lesson - get initial greeting from FA
const hasStarted = useRef(false);

useEffect(() => {
  if (!hasStarted.current) {
    hasStarted.current = true;
    startLesson();
  }
}, []);

  async function startLesson() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: 'Hello, I am ready to start the lesson.',
          conversationHistory: [],
        }),
      });
      
      const data = await response.json();
      
      if (data.response) {
        setMessages([{ role: 'assistant', content: data.response }]);
        // Play the greeting
        await speakText(data.response);
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
        // Stop all tracks to release microphone
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
      
      // Step 2: Send to Claude
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: userText,
          conversationHistory: messages,
        }),
      });
      
      const chatData = await chatResponse.json();
      
      if (chatData.response) {
        setMessages([...newMessages, { role: 'assistant', content: chatData.response }]);
        // Step 3: Speak the response
        await speakText(chatData.response);
      }
    } catch (error) {
      console.error('Error processing audio:', error);
    }
    
    setIsLoading(false);
  }

  async function speakText(text: string) {
    setIsPlaying(true);
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      
      if (!response.ok) {
        throw new Error('TTS request failed');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
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
          Lesson: Al-Fatiha
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
        {messages.length === 0 && isLoading && (
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
        
        {isLoading && messages.length > 0 && (
          <div style={{ 
            padding: '1rem',
            color: '#666',
            fontStyle: 'italic',
          }}>
            {isPlaying ? 'Speaking...' : 'Thinking...'}
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
          disabled={isLoading}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            backgroundColor: isRecording ? '#dc2626' : '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: '50px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1,
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

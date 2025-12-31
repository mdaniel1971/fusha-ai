'use client';

import { useState } from 'react';

export default function LessonPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');

  // TODO: Implement audio recording
  // TODO: Connect to transcribe API
  // TODO: Connect to chat API
  // TODO: Connect to speak API

  return (
    <main style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '2rem 1rem' 
    }}>
      <h1 style={{ marginBottom: '2rem' }}>Lesson: Al-Fatiha</h1>
      
      {/* Ayah display */}
      <div 
        className="arabic"
        style={{ 
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          textAlign: 'center',
        }}
      >
        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
      </div>

      {/* Recording button */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <button
          onClick={() => setIsRecording(!isRecording)}
          style={{
            padding: '1rem 2rem',
            fontSize: '1rem',
            backgroundColor: isRecording ? '#dc2626' : '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>

      {/* Transcript display */}
      {transcript && (
        <div style={{ marginBottom: '1rem' }}>
          <strong>You said:</strong>
          <p>{transcript}</p>
        </div>
      )}

      {/* AI response display */}
      {response && (
        <div style={{ 
          backgroundColor: '#f0f9ff',
          padding: '1rem',
          borderRadius: '8px',
        }}>
          <strong>FushaAI:</strong>
          <p>{response}</p>
        </div>
      )}
    </main>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SpeechBubbleProps {
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
  hotspotLabel?: string;
  hotspotLabelArabic?: string;
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  streamingText: string;
}

// Format text to render Arabic in larger Amiri font
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
            fontSize: '1.3em',
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
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {part}
      </span>
    );
  });
}

export default function SpeechBubble({
  isOpen,
  onClose,
  position,
  hotspotLabel,
  hotspotLabelArabic,
  messages,
  onSendMessage,
  isLoading,
  streamingText,
}: SpeechBubbleProps) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Calculate bubble position to stay within viewport
  const getBubbleStyle = () => {
    const bubbleWidth = 380;
    const bubbleHeight = 450;
    const tailSize = 20;
    const margin = 20;

    let top = position.top;
    let left = position.left;
    let tailPosition: 'left' | 'right' | 'top' | 'bottom' = 'left';

    // Check if bubble would go off right edge
    if (left + bubbleWidth + tailSize + margin > window.innerWidth) {
      left = position.left - bubbleWidth - tailSize;
      tailPosition = 'right';
    } else {
      left = position.left + tailSize;
      tailPosition = 'left';
    }

    // Check if bubble would go off bottom
    if (top + bubbleHeight > window.innerHeight - margin) {
      top = window.innerHeight - bubbleHeight - margin;
    }

    // Check if bubble would go off top
    if (top < margin) {
      top = margin;
    }

    return { top, left, tailPosition };
  };

  const handleInputChange = () => {
    if (!inputRef.current) return;
    const text = inputRef.current.textContent || '';
    setInputText(text);

    // Apply Arabic styling
    const arabicRegex = /([\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)/g;
    if (arabicRegex.test(text)) {
      const selection = window.getSelection();
      let cursorPosition = 0;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(inputRef.current);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        cursorPosition = preCaretRange.toString().length;
      }

      arabicRegex.lastIndex = 0;
      const parts = text.split(arabicRegex);
      inputRef.current.innerHTML = parts
        .map((part) => {
          arabicRegex.lastIndex = 0;
          if (arabicRegex.test(part)) {
            return `<span style="font-family: 'Amiri', 'Traditional Arabic', serif; font-size: 1.3em; line-height: 1.5;">${part}</span>`;
          }
          return part;
        })
        .join('');

      // Restore cursor
      if (selection) {
        let charCount = 0;
        const nodeIterator = document.createNodeIterator(inputRef.current, NodeFilter.SHOW_TEXT);
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

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (inputRef.current) {
      inputRef.current.textContent = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const { top, left, tailPosition } = getBubbleStyle();

  return (
    <>
      {/* Overlay to capture clicks outside */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Speech bubble */}
      <div
        ref={bubbleRef}
        style={{
          position: 'fixed',
          top,
          left,
          width: '380px',
          maxHeight: '450px',
          backgroundColor: '#fff',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'bubbleAppear 0.2s ease-out',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tail */}
        <div
          style={{
            position: 'absolute',
            top: '30px',
            [tailPosition]: '-10px',
            width: 0,
            height: 0,
            borderTop: '10px solid transparent',
            borderBottom: '10px solid transparent',
            [tailPosition === 'left' ? 'borderRight' : 'borderLeft']: '10px solid #fff',
            filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.1))',
          }}
        />

        {/* Header */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: '16px 16px 0 0',
          }}
        >
          <div>
            {hotspotLabelArabic && (
              <span
                style={{
                  fontFamily: "'Amiri', serif",
                  fontSize: '1.1rem',
                  color: '#333',
                  marginLeft: '8px',
                }}
              >
                {hotspotLabelArabic}
              </span>
            )}
            {hotspotLabel && (
              <span
                style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '0.9rem',
                  color: '#666',
                }}
              >
                {hotspotLabel}
              </span>
            )}
            {!hotspotLabel && !hotspotLabelArabic && (
              <span
                style={{
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '0.9rem',
                  color: '#666',
                }}
              >
                Conversation
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#999',
              cursor: 'pointer',
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Messages area */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            minHeight: '200px',
            maxHeight: '280px',
          }}
        >
          {messages.length === 0 && !streamingText && !isLoading && (
            <div
              style={{
                textAlign: 'center',
                color: '#999',
                fontFamily: 'Arial, sans-serif',
                fontSize: '0.9rem',
                padding: '2rem 1rem',
              }}
            >
              Click to start a conversation about this element
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5',
                marginLeft: msg.role === 'user' ? '20%' : '0',
                marginRight: msg.role === 'user' ? '0' : '20%',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              {formatWithArabic(msg.content)}
            </div>
          ))}

          {streamingText && (
            <div
              style={{
                marginBottom: '10px',
                padding: '8px 12px',
                borderRadius: '12px',
                backgroundColor: '#f5f5f5',
                marginRight: '20%',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              {formatWithArabic(streamingText)}
              <span style={{ opacity: 0.5 }}>|</span>
            </div>
          )}

          {isLoading && !streamingText && (
            <div
              style={{
                textAlign: 'center',
                color: '#666',
                padding: '10px',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  animation: 'pulse 1s infinite',
                }}
              >
                ...
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid #eee',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <div
            ref={inputRef}
            contentEditable={!isLoading}
            onInput={handleInputChange}
            onKeyDown={handleKeyDown}
            data-placeholder="Type your response..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              border: '1px solid #ddd',
              borderRadius: '20px',
              outline: 'none',
              minHeight: '20px',
              maxHeight: '60px',
              overflowY: 'auto',
              direction: 'ltr',
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputText.trim()}
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              fontFamily: 'Arial, sans-serif',
              backgroundColor: isLoading || !inputText.trim() ? '#ccc' : '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: '20px',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            Send
          </button>
        </div>
      </div>

      {/* Animations */}
      <style jsx global>{`
        @keyframes bubbleAppear {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }

        [data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #999;
          pointer-events: none;
        }

        [contenteditable]:focus {
          border-color: #3b82f6 !important;
        }
      `}</style>
    </>
  );
}

# FushaAI

A personal Quran Arabic tutor. Learn Quranic Arabic through conversation, not flashcards.

## Current State

- **Text chat**: Active ✅
- **Whiteboard**: Disabled (commented out)
- **Voice input (Whisper)**: Disabled (commented out)
- **Voice output (ElevenLabs)**: Disabled (commented out)

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Conversation | Claude API (Anthropic) | The AI teacher |
| Speech-to-text | Whisper API (OpenAI) | Transcribes your Arabic speech |
| Text-to-speech | ElevenLabs | Ustadh's voice |
| Frontend | Next.js | React framework with API routes |
| Database | Supabase | Auth, vocabulary, progress |

## Setup

```bash
npm install
cp .env.example .env.local
# Add your API keys to .env.local
npm run dev
```

Open http://localhost:3000/lesson

---

## Re-enabling Whiteboard Features

Whiteboard is commented out in `app/lesson/page.tsx`. To re-enable:

### Step-by-step:

#### 1. Uncomment the WhiteboardContent interface (near top of file)

Find and remove `/*` and `*/` around:
```typescript
interface WhiteboardContent {
  word?: string;
  transliteration?: string;
  // ... etc
}
```

#### 2. Uncomment whiteboard state (around line 35)

Find and uncomment:
```typescript
const [whiteboard, setWhiteboard] = useState<WhiteboardContent | null>(null);
```

#### 3. Uncomment parseWhiteboardContent function (around line 55)

Remove `/*` and `*/` around the entire `parseWhiteboardContent` function.

#### 4. Uncomment whiteboard parsing in streamChat (around line 110)

Find and uncomment:
```typescript
const { whiteboard: wb, speech } = parseWhiteboardContent(fullText);
if (wb && Object.keys(wb).length > 0) {
  setWhiteboard(wb);
}
setStreamingText(speech);
```

And:
```typescript
const { whiteboard: finalWb, speech: finalSpeech } = parseWhiteboardContent(fullText);
if (finalWb) setWhiteboard(finalWb);
```

#### 5. Uncomment renderWhiteboard function (around line 180)

Remove `/*` and `*/` around the entire `renderWhiteboard` function.

#### 6. Uncomment whiteboard render call in JSX (around line 280)

Find and uncomment:
```typescript
{renderWhiteboard()}
```

---

## Re-enabling Voice Features

Voice features are also commented out. To re-enable:

### Step-by-step:

#### 1. Uncomment state variables (around line 40)

Find and uncomment:
```typescript
const [isRecording, setIsRecording] = useState(false);
const [isPlaying, setIsPlaying] = useState(false);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);
const audioRef = useRef<HTMLAudioElement | null>(null);
```

#### 2. Uncomment voice functions (around line 150)

Find the large commented block containing:
- `startRecording()`
- `stopRecording()`
- `processAudio()`
- `playAudio()`

Remove the `/*` at the start and `*/` at the end.

#### 3. Uncomment the speaking indicator (around line 320)

Find and uncomment:
```typescript
{isPlaying && !streamingText && (
  <div style={{ ... }}>
    🔊 Speaking...
  </div>
)}
```

#### 4. Uncomment the recording button (at the bottom)

Find and uncomment the entire recording controls div.

### API Routes Required for Voice

Make sure these exist:
- `app/api/transcribe/route.ts` - Whisper integration
- `app/api/speak-stream/route.ts` - ElevenLabs integration

### Environment Variables for Voice

```env
OPENAI_API_KEY=sk-...        # For Whisper transcription
ELEVENLABS_API_KEY=...       # For text-to-speech
```

---

## Project Structure

```
fusha-ai/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Home page
│   ├── lesson/
│   │   └── page.tsx                # Main lesson interface
│   └── api/
│       ├── chat-stream/
│       │   └── route.ts            # Claude streaming endpoint
│       ├── transcribe/
│       │   └── route.ts            # Whisper (voice → text) [dormant]
│       └── speak-stream/
│           └── route.ts            # ElevenLabs (text → voice) [dormant]
├── lib/
│   ├── anthropic.ts
│   └── supabase.ts
├── .env.local                      # Your API keys (git ignored)
└── README.md
```

---

## Whiteboard Format (for reference)

When whiteboard is enabled, Claude outputs structured content:

```
[WHITEBOARD]
word: نَسْتَعِينُ
transliteration: nasta'een
meaning: we seek help
type: vocabulary
grammar: Form X (استفعل)
root: ع-و-ن
[/WHITEBOARD]

Now let's practice using this word...
```

The whiteboard appears instantly while audio (when enabled) loads in the background.
# FushaAI

بسم الله الرحمان الرحيم

Learn Quranic Arabic through conversing with a personal Quran Arabic tutor.

## What it does

- You work through ayaat, reciting and translating aloud
- FushaAI corrects naturally, like a human tutor would
- It drills into your specific gaps (vocabulary,grammar, morphology)
- Explains in your native language
- Assigns homework based on your mistakes
- Tracks your progress through the Quran

## Project Structure

```
fusha-ai/
├── app/                    # Next.js App Router - pages and API routes
│   ├── layout.tsx          # Root layout - wraps every page
│   ├── page.tsx            # Home page
│   ├── lesson/
│   │   └── page.tsx        # The lesson interface
│   └── api/                # Backend API routes (server-side, keys stay secret)
│       ├── transcribe/
│       │   └── route.ts    # Audio → Whisper → text
│       ├── chat/
│       │   └── route.ts    # Text → Claude → response
│       └── speak/
│           └── route.ts    # Text → TTS → audio
├── components/             # Reusable UI components
├── lib/                    # Shared utilities
│   ├── supabase.ts         # Supabase client setup
│   ├── anthropic.ts        # Claude client setup
│   └── openai.ts           # Whisper/TTS client setup
├── types/                  # TypeScript type definitions
│   └── index.ts
├── docs/                   # Documentation
│   └── TEACHING_METHODOLOGY.md
├── .env.example            # Template for environment variables
├── .env.local              # Your actual keys (git ignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Conversation | Claude API (Anthropic) | The AI teacher |
| Speech-to-text | Whisper API (OpenAI) | Transcribes your Arabic speech |
| Text-to-speech | OpenAI TTS | FushaAI's voice |
| Frontend | Next.js | React framework with API routes |
| Database | Supabase | Auth, vocabulary, progress, mistakes |
| Hosting | Vercel | Deployment |

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd fusha-ai
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to SQL Editor and run the schema from `docs/schema.sql`
3. Get your project URL and anon key from Settings → API

### 3. Get API keys

- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) → API Keys
- **OpenAI**: [platform.openai.com](https://platform.openai.com) → API Keys

### 4. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your keys.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Dependencies Explained

### Production

- **next** - React framework. Handles routing, server-side rendering, API routes.
- **react / react-dom** - UI library. Next.js is built on React.
- **@anthropic-ai/sdk** - Official Anthropic SDK. Used to call Claude for conversation.
- **openai** - Official OpenAI SDK. Used for Whisper (speech-to-text) and TTS (text-to-speech).
- **@supabase/supabase-js** - Supabase client. Database queries, auth, realtime subscriptions.

### Development

- **typescript** - Type safety. Catches errors before runtime.
- **@types/*** - Type definitions for React and Node.
- **eslint / eslint-config-next** - Code linting. Catches common mistakes.

## Licence

This project is a labour of love to help people understand the Quran.

# Technical Design Document
## AI-Enhanced FSRS for Japanese

**Version:** 1.1.0  
**Status:** Draft  
**Last Updated:** 2026-04-24

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Database Design](#4-database-design)
5. [API Design](#5-api-design)
6. [Frontend Architecture](#6-frontend-architecture)
7. [State Management](#7-state-management)
8. [AI Integration](#8-ai-integration)
9. [FSRS Implementation](#9-fsrs-implementation)
10. [Caching Strategy](#10-caching-strategy)
11. [Authentication](#11-authentication)
12. [Environment Configuration](#12-environment-configuration)

---

## 1. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | Next.js | 15.x (App Router) | Full-stack React framework, SSR/SSG, API routes |
| Client State | Zustand | 5.x | Global UI state, session state, optimistic review updates |
| Server State / Caching | TanStack Query | v5 | Data fetching, cache invalidation, background sync |
| Backend API | Express | 5.x | REST API server, middleware, route handling |
| Database | Supabase (PostgreSQL) | Latest | Primary datastore, auth, realtime subscriptions |
| Vector Search | pgvector | 0.8.x | Semantic similarity search on card embeddings |
| Cache / Rate Limiting | Upstash Redis | Latest | Session cache, rate limiting, review queue buffering |
| AI | OpenAI GPT-4o (Omni) | Latest | Card generation, mnemonics, sentence generation, explanations |
| SRS Algorithm | ts-fsrs | Latest | FSRS v5 scheduling algorithm |
| Language | TypeScript | 5.x | Strict typing across full stack |
| Package Manager | Bun | Latest | Monorepo workspace management, runtime, test runner |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Client                           │
│              Next.js 15 (App Router)                    │
│         Zustand (UI State) + TanStack Query             │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Express 5 API                        │
│              /api/* REST endpoints                      │
│         Auth middleware (Supabase JWT verify)           │
│              Rate limiting (Upstash Redis)              │
└──────────┬──────────────────┬───────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐  ┌───────────────────────────────────┐
│  Upstash Redis   │  │         Supabase (PostgreSQL)      │
│  - Review queue  │  │  - Users, cards, decks, reviews   │
│  - Rate limits   │  │  - FSRS scheduling state          │
│  - Session cache │  │  - pgvector embeddings            │
│  - AI resp cache │  │  - Realtime subscriptions         │
└──────────────────┘  └───────────────────────────────────┘
                                    │
                                    ▼
                       ┌────────────────────────┐
                       │   OpenAI GPT-4o API    │
                       │  - Card generation     │
                       │  - Sentence synthesis  │
                       │  - Mnemonics           │
                       │  - Embeddings          │
                       └────────────────────────┘
```

### 2.1 Deployment

- Next.js frontend and Express API deployed separately (e.g. Vercel + Railway or Render)
- Supabase managed PostgreSQL instance
- Upstash Redis serverless instance
- Environment variables managed per-environment (development, staging, production)

---

## 3. Repository Structure

```
fsrs-japanese/
├── apps/
│   ├── web/                        # Next.js 15 frontend
│   │   ├── app/                    # App Router pages and layouts
│   │   │   ├── (auth)/             # Auth group (login, signup)
│   │   │   ├── (app)/              # Protected app group
│   │   │   │   ├── dashboard/
│   │   │   │   ├── review/
│   │   │   │   ├── decks/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/                 # Base design system components
│   │   │   ├── review/             # Review session components
│   │   │   ├── cards/              # Card display and editor
│   │   │   ├── analytics/          # Charts and progress views
│   │   │   └── shared/             # Shared layout components
│   │   ├── lib/
│   │   │   ├── api/                # API client functions (TanStack Query)
│   │   │   ├── stores/             # Zustand stores
│   │   │   └── utils/
│   │   └── public/
│   │
│   └── api/                        # Express 5 backend
│       ├── src/
│       │   ├── routes/             # Path → controller mapping only
│       │   │   ├── auth.ts
│       │   │   ├── decks.ts
│       │   │   ├── cards.ts
│       │   │   ├── reviews.ts
│       │   │   ├── ai.ts
│       │   │   └── analytics.ts
│       │   ├── controllers/        # Request parsing, response sending
│       │   │   ├── auth.controller.ts
│       │   │   ├── decks.controller.ts
│       │   │   ├── cards.controller.ts
│       │   │   ├── reviews.controller.ts
│       │   │   ├── ai.controller.ts
│       │   │   └── analytics.controller.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts         # JWT verification via Supabase
│       │   │   ├── rateLimit.ts    # Upstash Redis rate limiting
│       │   │   ├── errorHandler.ts
│       │   │   └── __tests__/      # Unit tests (mocked deps, no env vars needed)
│       │   │       └── auth.middleware.test.ts
│       │   ├── services/           # Business logic, DB queries
│       │   │   ├── fsrs.service.ts
│       │   │   ├── ai.service.ts
│       │   │   ├── card.service.ts
│       │   │   ├── analytics.service.ts
│       │   │   └── __tests__/      # Unit tests for pure service logic
│       │   │       └── fsrs.service.test.ts
│       │   ├── schemas/            # Zod validation schemas
│       │   │   ├── auth.schema.ts
│       │   │   └── __tests__/      # Schema validation unit tests
│       │   │       └── auth.schema.test.ts
│       │   ├── db/
│       │   │   ├── supabase.ts     # Supabase client
│       │   │   └── redis.ts        # Upstash Redis client
│       │   └── index.ts
│       ├── tests/
│       │   └── integration/        # Integration tests (require live DB + Redis)
│       │       ├── auth.routes.test.ts
│       │       ├── cards.routes.test.ts
│       │       └── reviews.routes.test.ts
│       └── tsconfig.json
│
├── packages/
│   ├── shared-types/               # Shared TypeScript types
│   │   └── src/
│   │       ├── card.types.ts
│   │       ├── review.types.ts
│   │       ├── deck.types.ts
│   │       └── fsrs.types.ts
│   └── tsconfig/                   # Shared tsconfig base
│
├── supabase/
│   ├── migrations/                 # SQL migration files
│   └── seed.sql
│
├── bunfig.toml                     # Bun workspace + registry config
├── package.json                    # Workspace root (workspaces: ["apps/*","packages/*"])
├── turbo.json                      # Turborepo config (optional)
└── CLAUDE.md
```

---

## 4. Database Design

All tables use `UUID` primary keys and include `created_at` / `updated_at` timestamps unless noted.

### 4.1 Users (Extended Profile)

Supabase Auth handles the core `auth.users` table. A `profiles` table extends it:

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  native_language TEXT DEFAULT 'en',
  jlpt_target TEXT CHECK (jlpt_target IN ('N5','N4','N3','N2','N1','beyond_jlpt')),
  study_goal TEXT,
  interests TEXT[],            -- e.g. ['anime', 'gaming', 'cooking']
  daily_new_cards_limit INT DEFAULT 20,
  daily_review_limit INT DEFAULT 200,
  retention_target FLOAT DEFAULT 0.85,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

```sql
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  deck_type TEXT CHECK (deck_type IN ('vocabulary','grammar','kanji','mixed')) DEFAULT 'vocabulary',
  is_public BOOLEAN DEFAULT FALSE,
  is_premade_fork BOOLEAN DEFAULT FALSE,  -- TRUE if cloned from a premade deck
  source_premade_id UUID,                  -- references premade_decks(id) if forked
  card_count INT DEFAULT 0,               -- denormalized counter
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Premade Decks

Premade decks are curated, system-owned decks. They are not owned by any user (`user_id` is NULL). Users subscribe to them or fork them.

```sql
CREATE TABLE premade_decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deck_type TEXT CHECK (deck_type IN ('vocabulary','grammar','kanji','mixed')) NOT NULL,
  jlpt_level jlpt_level,                 -- NULL for multi-level or domain decks
  domain TEXT,                            -- e.g. 'business', 'anime', 'travel', NULL for JLPT decks
  card_count INT DEFAULT 0,
  version INT DEFAULT 1,                  -- incremented on content updates
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: which premade decks a user has subscribed to
CREATE TABLE user_premade_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  premade_deck_id UUID REFERENCES premade_decks(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_version INT DEFAULT 1,        -- for tracking update notifications
  UNIQUE(user_id, premade_deck_id)
);
```

**Seed data for premade decks** lives in `supabase/seed.sql`. The canonical premade card content is stored in the `cards` table with `user_id = NULL` and linked to a `premade_deck_id`. When a user subscribes, a copy of each card is created in their personal queue with FSRS state initialized to `new`.



### 4.4 Cards

```sql
CREATE TYPE card_status AS ENUM ('new', 'learning', 'review', 'relearning', 'suspended');
CREATE TYPE card_type AS ENUM ('recognition', 'production', 'reading', 'audio', 'grammar');
CREATE TYPE jlpt_level AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt');
CREATE TYPE register_tag AS ENUM ('casual', 'formal', 'written', 'archaic', 'slang', 'gendered', 'neutral');

CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- Core content
  word TEXT NOT NULL,
  reading TEXT,               -- Hiragana reading
  meaning TEXT NOT NULL,
  part_of_speech TEXT,
  jlpt_level jlpt_level,
  frequency_rank INT,
  register register_tag DEFAULT 'neutral',

  -- Extended content (AI-generated or user-provided)
  example_sentences JSONB DEFAULT '[]',  -- [{ja: "", en: "", furigana: ""}]
  kanji_breakdown JSONB DEFAULT '[]',    -- [{kanji: "", radical: "", meaning: ""}]
  pitch_accent TEXT,
  mnemonics JSONB DEFAULT '[]',         -- [{text: "", author: "ai|user"}]
  collocations TEXT[],
  homophones TEXT[],
  tags TEXT[],

  -- Card type
  card_type card_type NOT NULL DEFAULT 'recognition',
  parent_card_id UUID REFERENCES cards(id), -- Links sibling cards (same word)

  -- FSRS state (via ts-fsrs)
  status card_status DEFAULT 'new',
  due TIMESTAMPTZ DEFAULT NOW(),
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  last_review TIMESTAMPTZ,
  state INT DEFAULT 0,        -- FSRS internal state

  -- Vector embedding for semantic similarity
  embedding vector(1536),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX cards_user_due_idx ON cards(user_id, due);
CREATE INDEX cards_deck_idx ON cards(deck_id);
CREATE INDEX cards_parent_idx ON cards(parent_card_id);
CREATE INDEX cards_embedding_idx ON cards USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 4.4 Review Logs

### 4.5 Review Logs

```sql
CREATE TYPE review_rating AS ENUM ('again', 'hard', 'good', 'easy');

CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  rating review_rating NOT NULL,
  review_time_ms INT,          -- Time spent on card in milliseconds
  
  -- FSRS state snapshot after review
  stability_after FLOAT,
  difficulty_after FLOAT,
  due_after TIMESTAMPTZ,
  scheduled_days_after INT,

  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX review_logs_user_date_idx ON review_logs(user_id, reviewed_at);
CREATE INDEX review_logs_card_idx ON review_logs(card_id);
```

### 4.6 Grammar Patterns

```sql
CREATE TABLE grammar_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,

  pattern TEXT NOT NULL,           -- e.g. "〜ている"
  meaning TEXT NOT NULL,
  jlpt_level jlpt_level,
  example_sentences JSONB DEFAULT '[]',
  linked_vocabulary UUID[],        -- card IDs commonly used with this pattern
  notes TEXT,

  -- FSRS state (same fields as cards)
  status card_status DEFAULT 'new',
  due TIMESTAMPTZ DEFAULT NOW(),
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.7 User Leech Flags

```sql
CREATE TABLE leeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  diagnosis TEXT,             -- AI-generated diagnosis
  prescription TEXT,          -- AI-generated action
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.7 Row Level Security

All tables enforce RLS. Example policy for `cards`:

```sql
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own cards"
  ON cards FOR ALL
  USING (auth.uid() = user_id);
```

The same pattern applies to `decks`, `review_logs`, `grammar_patterns`, and `leeches`.

---

## 5. API Design

The Express API is versioned at `/api/v1`. All endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header unless noted.

### 5.1 Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/signup` | Create account via Supabase Auth |
| POST | `/api/v1/auth/login` | Login, return access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate session |

### 5.2 Decks

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/decks` | List user's decks |
| POST | `/api/v1/decks` | Create a new deck |
| GET | `/api/v1/decks/:id` | Get a deck with stats |
| PATCH | `/api/v1/decks/:id` | Update deck metadata |
| DELETE | `/api/v1/decks/:id` | Delete deck and all cards |

### 5.3 Cards

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/decks/:deckId/cards` | List cards in a deck (paginated) |
| POST | `/api/v1/decks/:deckId/cards` | Add a card manually |
| GET | `/api/v1/cards/:id` | Get single card |
| PATCH | `/api/v1/cards/:id` | Update card content |
| DELETE | `/api/v1/cards/:id` | Delete card |
| GET | `/api/v1/cards/:id/similar` | Get semantically similar cards via pgvector |

### 5.4 Reviews

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/reviews/due` | Get due cards for today's review session |
| POST | `/api/v1/reviews/submit` | Submit a single review rating, update FSRS state |
| POST | `/api/v1/reviews/batch` | Submit offline-buffered review batch |
| GET | `/api/v1/reviews/forecast` | Get review count forecast for next 14 days |

#### Submit Review — Request Body

```json
{
  "cardId": "uuid",
  "rating": "good",
  "reviewTimeMs": 4200
}
```

#### Submit Review — Response

```json
{
  "card": {
    "id": "uuid",
    "due": "2026-04-22T09:00:00Z",
    "stability": 4.72,
    "difficulty": 5.1,
    "scheduledDays": 3,
    "state": 2
  }
}
```

### 5.5 AI Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/ai/generate-card` | Generate full card content from a word |
| POST | `/api/v1/ai/generate-sentences` | Generate fresh example sentences for a card |
| POST | `/api/v1/ai/generate-mnemonic` | Generate a personalized mnemonic |
| POST | `/api/v1/ai/explain-failure` | Explain why an answer is correct on card fail |
| POST | `/api/v1/ai/diagnose-leech` | Diagnose and prescribe action for a leech card |
| GET | `/api/v1/ai/weakness-report` | Generate macro weakness analysis for the user |

#### Generate Card — Request Body

```json
{
  "word": "木漏れ日",
  "deckId": "uuid",
  "userLevel": "N3",
  "interests": ["nature", "photography"]
}
```

### 5.6 Analytics

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/analytics/heatmap` | Retention heatmap data (last 365 days) |
| GET | `/api/v1/analytics/accuracy` | Accuracy breakdown by card type |
| GET | `/api/v1/analytics/jlpt-gap` | JLPT gap analysis for target level |
| GET | `/api/v1/analytics/streak` | Current and longest streak |
| GET | `/api/v1/analytics/forecast` | Projected milestone dates |

---

## 6. Frontend Architecture

### 6.1 App Router Structure

Next.js 15 App Router is used throughout. Route groups separate auth from the protected app shell.

```
app/
├── layout.tsx              # Root layout (fonts, providers)
├── page.tsx                # Landing page (public)
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
└── (app)/
    ├── layout.tsx          # Protected layout (sidebar, nav)
    ├── dashboard/page.tsx
    ├── review/
    │   └── [sessionId]/page.tsx
    ├── decks/
    │   ├── page.tsx        # Deck list
    │   └── [deckId]/
    │       ├── page.tsx    # Deck detail
    │       └── cards/page.tsx
    ├── analytics/page.tsx
    └── settings/page.tsx
```

### 6.2 Review Session Flow

The review session is the most performance-sensitive UI. It must feel instant.

```
ReviewSessionPage
├── useReviewSession (Zustand)  ← holds queue, current card, progress
├── ReviewCard
│   ├── CardFront               ← word, reading (if audio mode)
│   ├── CardBack                ← meaning, example sentences, kanji breakdown
│   └── RatingButtons           ← Again / Hard / Good / Easy
├── ReviewProgress              ← session progress bar
└── SessionSummary              ← shown on session complete
```

On `ratingButtons` click:
1. Zustand updates the queue optimistically (next card appears instantly)
2. TanStack Query mutation fires `POST /api/v1/reviews/submit` in the background
3. If the request fails, it's queued to Upstash Redis for retry via the batch endpoint

### 6.3 Key Components

```
components/
├── ui/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Dialog.tsx
│   └── ...
├── review/
│   ├── ReviewCard.tsx
│   ├── RatingButtons.tsx
│   ├── ReviewProgress.tsx
│   ├── SessionSummary.tsx
│   └── CardExplainer.tsx       ← AI explanation panel
├── cards/
│   ├── CardEditor.tsx
│   ├── KanjiBreakdown.tsx
│   ├── PitchAccentDiagram.tsx
│   ├── FuriganaText.tsx
│   └── AIGenerateButton.tsx
├── analytics/
│   ├── RetentionHeatmap.tsx
│   ├── AccuracyBreakdown.tsx
│   ├── JLPTGapAnalysis.tsx
│   └── ReviewForecastChart.tsx
└── shared/
    ├── Sidebar.tsx
    ├── TopNav.tsx
    └── LoadingSpinner.tsx
```

---

## 7. State Management

### 7.1 Zustand Stores

State is split into focused stores to avoid monolithic global state.

#### `useReviewSessionStore`
Manages the active review session entirely client-side for zero-latency UX.

```typescript
interface ReviewSessionState {
  queue: Card[]
  currentIndex: number
  completed: ReviewResult[]
  sessionStarted: boolean
  showAnswer: boolean

  actions: {
    startSession: (cards: Card[]) => void
    flipCard: () => void
    submitRating: (rating: Rating) => void
    endSession: () => void
  }
}
```

#### `useUserStore`
Holds authenticated user profile and preferences.

```typescript
interface UserState {
  profile: Profile | null
  isLoading: boolean
  actions: {
    setProfile: (profile: Profile) => void
    updatePreferences: (prefs: Partial<Profile>) => void
  }
}
```

#### `useUIStore`
Manages transient UI state (modals, sidebars, toasts).

```typescript
interface UIState {
  sidebarOpen: boolean
  activeModal: string | null
  actions: {
    toggleSidebar: () => void
    openModal: (id: string) => void
    closeModal: () => void
  }
}
```

### 7.2 TanStack Query Usage

TanStack Query v5 handles all server state — fetching, caching, and mutation.

```typescript
// Fetch due cards
const { data: dueCards } = useQuery({
  queryKey: ['reviews', 'due'],
  queryFn: () => api.reviews.getDue(),
  staleTime: 1000 * 60 * 5,  // 5 min
})

// Submit review mutation
const submitReview = useMutation({
  mutationFn: api.reviews.submit,
  onMutate: async (variables) => {
    // Optimistic update — advance queue immediately
    queryClient.cancelQueries({ queryKey: ['reviews', 'due'] })
  },
  onError: (err, variables) => {
    // Queue for offline batch retry
    offlineQueue.add(variables)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }
})
```

---

## 8. AI Integration

### 8.1 OpenAI GPT-4o Configuration

All AI calls go through the `ai.service.ts` singleton in the Express API. The frontend never calls OpenAI directly.

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
```

### 8.2 Card Generation Prompt Strategy

Card generation uses a structured JSON output schema to ensure parseable, consistent responses.

```typescript
async function generateCard(word: string, userLevel: string, interests: string[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a Japanese language expert generating SRS card data.
        Always respond with valid JSON matching the schema exactly.
        User level: ${userLevel}. User interests: ${interests.join(', ')}.
        Generate example sentences at or slightly above the user's level.
        Do not use grammar patterns above the user's level.`
      },
      {
        role: 'user',
        content: `Generate complete card data for the Japanese word: ${word}
        
        Return JSON with this exact shape:
        {
          "word": string,
          "reading": string (hiragana),
          "meaning": string (English),
          "partOfSpeech": string,
          "jlptLevel": "N5"|"N4"|"N3"|"N2"|"N1"|null,
          "register": "casual"|"formal"|"written"|"archaic"|"slang"|"gendered"|"neutral",
          "exampleSentences": [{ "ja": string, "en": string, "furigana": string }],
          "kanjiBreakdown": [{ "kanji": string, "radical": string, "meaning": string, "reading": string }],
          "pitchAccent": string,
          "mnemonic": string,
          "collocations": string[],
          "homophones": string[]
        }`
      }
    ]
  })

  return JSON.parse(response.choices[0].message.content!)
}
```

### 8.3 Embeddings for Semantic Search

Card embeddings power the "similar cards" feature via pgvector.

```typescript
async function generateEmbedding(card: Card): Promise<number[]> {
  const text = `${card.word} ${card.reading} ${card.meaning} ${card.tags.join(' ')}`
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}
```

Stored in the `embedding vector(1536)` column and queried with:

```sql
SELECT id, word, meaning,
  1 - (embedding <=> $1::vector) AS similarity
FROM cards
WHERE user_id = $2
  AND id != $3
ORDER BY embedding <=> $1::vector
LIMIT 10;
```

### 8.4 AI Response Caching

Identical AI requests (same word, same level, same interests hash) are cached in Upstash Redis for 7 days to reduce OpenAI costs.

```typescript
const cacheKey = `card:${word}:${userLevel}:${hash(interests)}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)

const result = await generateCard(word, userLevel, interests)
await redis.set(cacheKey, JSON.stringify(result), { ex: 60 * 60 * 24 * 7 })
return result
```

---

## 9. FSRS Implementation

### 9.1 ts-fsrs Integration

`ts-fsrs` provides the core FSRS v5 algorithm. The service wraps it to persist state to Supabase after every review.

```typescript
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs'

const params = generatorParameters({ request_retention: 0.85 })
const f = fsrs(params)

async function processReview(cardId: string, rating: Rating, userId: string) {
  const card = await db.cards.findOne({ id: cardId, userId })
  
  const fsrsCard = {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review,
  }

  const result = f.repeat(fsrsCard, new Date())
  const updated = result[rating].card

  await db.cards.update(cardId, {
    due: updated.due,
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    state: updated.state,
    last_review: updated.last_review,
    status: mapState(updated.state),
  })

  await db.reviewLogs.create({
    cardId,
    userId,
    rating,
    stabilityAfter: updated.stability,
    difficultyAfter: updated.difficulty,
    dueAfter: updated.due,
    scheduledDaysAfter: updated.scheduled_days,
  })

  return updated
}
```

### 9.2 Per-Card-Type Retention Parameters

Different FSRS parameter sets are maintained for each card type, allowing separate forgetting curves:

```typescript
const cardTypeParams: Record<CardType, Partial<FSRSParameters>> = {
  recognition:  generatorParameters({ request_retention: 0.90 }),
  production:   generatorParameters({ request_retention: 0.85 }),
  reading:      generatorParameters({ request_retention: 0.88 }),
  audio:        generatorParameters({ request_retention: 0.82 }),
  grammar:      generatorParameters({ request_retention: 0.87 }),
}
```

### 9.3 Leech Detection

A card is flagged as a leech when `lapses >= 8` (configurable). The leech service triggers AI diagnosis:

```typescript
async function checkLeech(card: Card) {
  if (card.lapses >= LEECH_THRESHOLD) {
    const existingLeech = await db.leeches.findOne({ cardId: card.id, resolved: false })
    if (!existingLeech) {
      const diagnosis = await aiService.diagnoseLeech(card)
      await db.leeches.create({ cardId: card.id, userId: card.userId, ...diagnosis })
    }
  }
}
```

---

## 10. Caching Strategy

### 10.1 Redis Cache Keys

| Key Pattern | TTL | Content |
|---|---|---|
| `card:{word}:{level}:{interestsHash}` | 7 days | AI-generated card data |
| `mnemonic:{word}:{userId}` | 30 days | User-specific mnemonic |
| `due:{userId}` | 5 min | Due card IDs for today |
| `analytics:{userId}:heatmap` | 1 hour | Heatmap data |
| `analytics:{userId}:jlpt-gap` | 6 hours | JLPT gap analysis |
| `ratelimit:{userId}:ai` | 1 min | AI endpoint rate limit counter |

### 10.2 Rate Limiting

AI endpoints are rate-limited per user using Upstash Redis sliding window:

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 AI calls per minute
})

const { success } = await ratelimit.limit(`ai:${userId}`)
if (!success) return res.status(429).json({ error: 'Too many requests' })
```

---

## 11. Authentication

Supabase Auth handles authentication. The Express API verifies JWTs using the Supabase JWT secret.

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Invalid token' })

  req.user = user
  next()
}
```

On the Next.js side, Supabase SSR helpers manage session cookies and server-side auth state across App Router layouts and middleware.

---

## 12. Environment Configuration

### 12.1 Backend (`apps/api/.env`)

```env
# Server
PORT=3001
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-redis-token

# OpenAI
OPENAI_API_KEY=sk-...

# FSRS
LEECH_THRESHOLD=8
DEFAULT_RETENTION_TARGET=0.85
```

### 12.2 Frontend (`apps/web/.env.local`)

```env
# Next.js Public
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

*End of TDD v1.0.0*

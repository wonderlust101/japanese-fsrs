# Technical Design Document
## AI-Enhanced FSRS for Japanese

**Version:** 1.3.0  
**Status:** Active  
**Last Updated:** 2026-04-28

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
| AI | OpenAI gpt-5.4 nano | Latest | Card generation, mnemonics, sentence generation, explanations |
| SRS Algorithm (runtime) | ts-fsrs | 5.3.x | Full FSRS v5 scheduler (state machine, rollback, forget, reschedule) |
| SRS Algorithm (optimizer) | @open-spaced-repetition/binding | Latest | FSRS Rust bindings — reserved for future `computeParameters()` weight training |
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
│   │   │   └── utils/
│   │   ├── stores/                 # Zustand stores
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
  -- display_name is stored in auth.users user_metadata, not duplicated here
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



### 4.4 Ultra-Lean Card Architecture

To prioritize "Premium Defaults" and system performance, Tomo uses an "Ultra-Lean" model. All layouts are defined in the application code, and the database stores the content in a flexible JSONB column. This ensures the number of fields available can change dynamically to adapt to different layouts (e.g., Comprehension vs. Production).

```sql
CREATE TYPE card_status AS ENUM ('new', 'learning', 'review', 'relearning', 'suspended');
CREATE TYPE layout_type AS ENUM ('comprehension', 'production', 'listening');
CREATE TYPE jlpt_level AS ENUM ('N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt');
CREATE TYPE register_tag AS ENUM ('casual', 'formal', 'written', 'archaic', 'slang', 'gendered', 'neutral');

-- The SRS item (The Content + The Test in one row)
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  
  -- The Review Layout (drives FSRS scheduler selection and card presentation)
  layout_type layout_type NOT NULL DEFAULT 'comprehension',
  
  -- The Content (The "Flexible" Part replacing 20 columns)
  -- The fields available change dynamically based on the layout_type.
  -- e.g., Comprehension: {"word": "...", "reading": "...", "meaning": "..."}
  -- e.g., Production: {"meaning": "...", "word": "...", "reading": "..."}
  fields_data JSONB NOT NULL DEFAULT '{}', 
  
  -- Sibling & Conjugation Sync (The v1.3 Bridge)
  -- Links a Production card back to its Comprehension sibling,
  -- or a conjugated verb back to its dictionary form.
  parent_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,

  -- Metadata (Extracted from JSONB for fast indexing/filtering)
  tags TEXT[],
  jlpt_level jlpt_level,
  
  -- Morphological analysis readiness (v1.3)
  tokens JSONB DEFAULT '[]',  -- [{surface: "", reading: "", pos: "", lemma: ""}]
  parsed_at TIMESTAMPTZ,      -- Last analysis timestamp
  
  -- Vector embedding for AI similarity search (Generated from fields_data)
  embedding vector(1536),

  -- FSRS state (managed by ts-fsrs via fsrs.service.ts)
  status card_status DEFAULT 'new',
  due TIMESTAMPTZ DEFAULT NOW(),
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  last_review TIMESTAMPTZ,
  state INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX cards_user_due_idx ON cards(user_id, due);
CREATE INDEX cards_deck_idx ON cards(deck_id);
CREATE INDEX cards_parent_idx ON cards(parent_card_id);
CREATE INDEX cards_embedding_idx ON cards USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

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

### 4.6 User Leech Flags

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

All tables enforce RLS to ensure multi-tenant safety.

```sql
-- Cards: Strict owner access
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own cards" ON cards FOR ALL USING (auth.uid() = user_id);
```

The same owner-only access pattern applies to `decks`, `review_logs`, and `leeches`.

---

## 5. API Design

The Express API is versioned at `/api/v1`. All endpoints require a valid Supabase JWT in the `Authorization: Bearer <token>` header unless noted.

### 5.1 Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/signup` | Create account, send OTP verification email |
| POST | `/api/v1/auth/cancel-signup` | Delete unconfirmed account on signup abandon |
| POST | `/api/v1/auth/login` | Login, return access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Invalidate session |
| POST | `/api/v1/auth/login-otp` | Request a login OTP (v1.2) |
| POST | `/api/v1/auth/verify-otp` | Verify login OTP and return tokens (v1.2) |

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

### 5.5 AI Endpoints (P0 + Planned)

| Method | Path | Description | Priority |
|---|---|---|---|
| POST | `/api/v1/ai/generate-card` | Generate full card content from a word | 🟢 P0 |
| POST | `/api/v1/ai/generate-sentences` | Generate fresh example sentences for a card | 🟢 P0 |
| POST | `/api/v1/ai/generate-mnemonic` | Generate a personalized mnemonic | 🟢 P0 |
| POST | `/api/v1/ai/explain-failure` | Explain why an answer is correct on card fail | 🟡 v1.4 |
| POST | `/api/v1/ai/diagnose-leech` | Diagnose and prescribe action for a leech card | 🟡 v1.4 |
| GET | `/api/v1/ai/weakness-report` | Generate macro weakness analysis for the user | 🟡 v1.4 |

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
| GET | `/api/v1/analytics/accuracy` | Accuracy breakdown by layout |
| GET | `/api/v1/analytics/jlpt-gap` | JLPT gap analysis for target level |
| GET | `/api/v1/analytics/streak` | Current and longest streak |
| GET | `/api/v1/analytics/forecast` | Projected milestone dates |

### 5.7 Profiles & Preferences

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/profile` | Get current user's profile and study preferences |
| PATCH | `/api/v1/profile` | Update user preferences (daily limits, goals, interests) |

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
    setProfile:        (profile: Profile) => void
    setLoading:        (loading: boolean) => void
    updatePreferences: (prefs: Partial<Profile>) => void
    reset:             () => void
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

### 8.1 OpenAI GPT-5.4 nano Configuration

All AI calls go through the `ai.service.ts` singleton in the Express API. The frontend never calls OpenAI directly.

```typescript
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})
```

### 8.2 Card Generation Prompt Strategy

Card generation uses a structured JSON output schema. The resulting object is stored directly in the `fields_data` JSONB column.

```typescript
async function generateCard(word: string, userLevel: string, interests: string[]) {
  const response = await openai.chat.completions.create({
    model: 'gpt-5.4 nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a Japanese language expert generating SRS card data.
        Always respond with valid JSON.
        User level: ${userLevel}. User interests: ${interests.join(', ')}.
        Generate content for the "fields_data" column.`
      },
      {
        role: 'user',
        content: `Generate complete card data for: ${word}
        
        Return JSON with these potential keys based on the word type:
        {
          "word": string,
          "reading": string,
          "meaning": string,
          "partOfSpeech": string,
          "exampleSentences": [{ "ja": string, "en": string, "furigana": string }],
          "kanjiBreakdown": [{ "kanji": string, "meaning": string }],
          "pitchAccent": string,
          "mnemonic": string
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
  const text = `${card.fields_data.word} ${card.fields_data.reading} ${card.fields_data.meaning} ${card.tags.join(' ')}`
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })

  return response.data[0].embedding
}
```

Stored in the `embedding vector(1536)` column and queried with:

```sql
SELECT id, fields_data->>'word' as word, fields_data->>'meaning' as meaning,
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

`ts-fsrs` is the runtime FSRS v5 scheduler. All FSRS state transitions go through `apps/api/src/services/fsrs.service.ts` which wraps `ts-fsrs` to persist state to Supabase.

Per-card-type FSRS instances are created at module load with `generatorParameters`:

```typescript
import { fsrs, generatorParameters, Rating, State } from 'ts-fsrs'

const scheduler = fsrs(generatorParameters({ request_retention: 0.85 }))
```

Normal reviews use `f.next()` (single grade, O(1)):

```typescript
const { card: updated } = scheduler.next(buildFsrsCard(row), new Date(), Rating.Good)
// updated.due, updated.stability, updated.difficulty, updated.scheduled_days
// updated.state (State.New / Learning / Review / Relearning)
// updated.reps, updated.lapses, updated.learning_steps
```

All four outcomes preview (UI only, no DB write) uses `f.repeat()`:

```typescript
const preview = scheduler.repeat(buildFsrsCard(row), new Date())
// preview[Rating.Again].card, preview[Rating.Good].card, etc.
```

The card update, review log insert, and leech detection are executed atomically inside the `process_review` PostgreSQL RPC. The review log row includes a before-snapshot of all FSRS fields to enable future rollback.

### 9.2 Linked Card Sync (v1.3)

Sibling cards (Comprehension, Production, Listening) sharing the same `parent_card_id` synchronize their stability and difficulty to prevent redundant reviews of the same linguistic concept.

**Sync Logic:**
1. When a card is reviewed, its new `stability` and `difficulty` are calculated.
2. Sibling cards (those with the same `parent_card_id`) have their `stability` and `difficulty` updated to match.
3. Their `due` dates are re-calculated based on the new stability.

```typescript
async function syncSiblingCards(parentId: string, sourceCardId: string, newState: any) {
  await db.cards.updateMany(
    { parent_card_id: parentId, id: { ne: sourceCardId } },
    { 
      stability: newState.stability,
      difficulty: newState.difficulty,
      // Recalculate due date based on new stability
      due: calculateNewDueDate(newState.stability)
    }
  )
}
```

### 9.3 Conjugation Architecture (v1.3)

Verbs and adjectives use a parent-child relationship for their 20+ conjugation forms (te-form, dictionary form, potential, etc.).

**Schema Design:**
- **Parent Card**: The base dictionary form (e.g., 食べる).
- **Child Cards**: Conjugated forms (e.g., 食べられる).
- `parent_card_id` links child cards to the dictionary form.
- Child cards inherit the `meaning` from the parent's `fields_data` but have their own `word` and `reading` in their own `fields_data`.

**FSRS Inheritance:**
- Success on a conjugated form provides a small stability boost (0.2x) to the parent dictionary form.
- Success on the dictionary form provides a significant stability boost (0.5x) to all known conjugated forms.

### 9.4 Per-Layout Retention Parameters

Each layout gets its own FSRS instance baked at startup with a different `request_retention`. This models measurably different forgetting curves per modality in Japanese learners. Do not consolidate into a single parameter set.

```typescript
const schedulers: Record<LayoutType, FSRS> = {
    // Passive comprehension is easiest; keep retention high to ensure mastery.
    comprehension: fsrs(generatorParameters({ request_retention: 0.90 })),

    // Active production is the hardest. Dropping to 0.84 prevents burnout
    // from constant failures while still building long-term memory.
    production:    fsrs(generatorParameters({ request_retention: 0.84 })),

    // Listening is often harder due to speed and reduced visual cues.
    listening:     fsrs(generatorParameters({ request_retention: 0.82 })),
}
```

These match the `layout_type` DB enum: `comprehension`, `production`, `listening`.

### 9.5 Advanced FSRS Features

All features below are implemented in `fsrs.service.ts`. DB-dependent features require the migrations from `20260502000000` through `20260502000003`.

| Feature | Service Function | DB Dependency | Status |
|---|---|---|---|
| Normal review | `processReview()` | `process_review` RPC | Implemented |
| Undo last review | `rollbackReview()` | before-snapshot cols (migration 0001) | Implemented |
| Forget / reset card | `forgetCard()` | `process_forget` RPC (migration 0003) | Implemented |
| Retrievability % | `getRetrievability()` | None (pure math) | Implemented |
| Preview 4 outcomes | `previewNextStates()` | None (pure math) | Implemented |
| Reschedule from history | `rescheduleFromHistory()` | Full review_logs with before-snapshot | Implemented |
| Interval fuzzing | Set `enable_fuzz: true` in `generatorParameters` | None | Ready to enable |
| Custom learning steps | Set `learning_steps` in `generatorParameters` | None | Ready to enable |
| Max interval cap | Set `maximum_interval` in `generatorParameters` | None | Ready to enable |
| Per-user weight optimization | `computeParameters()` via binding | Full review history CSV | Future |

### 9.6 Dual-Package Architecture

Two packages serve complementary purposes:

| Package | Role | Used in |
|---|---|---|
| `ts-fsrs` | Runtime FSRS scheduler — state machine, `f.next()`, `f.forget()`, `f.rollback()`, `f.reschedule()`, `f.repeat()` | `fsrs.service.ts` |
| `@open-spaced-repetition/binding` | Parameter optimizer — `computeParameters()` trains per-user FSRS weights from review history | Not yet wired; reserved for future weight training |

`@open-spaced-repetition/binding` provides no state machine, no Rating enum, and no `createEmptyCard`. Its `nextStates()` computes FSRS math but the higher-level scheduling features all live in `ts-fsrs`.

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

Supabase Auth handles all authentication. The Express API verifies JWTs using `supabase.auth.getUser(token)` (never by decoding the JWT locally). The Next.js frontend uses `@supabase/ssr` to manage session cookies across App Router layouts.

### 11.1 Auth Middleware (Express)

Every protected Express route passes through `authMiddleware`, which extracts the Bearer token and validates it against Supabase:

```typescript
// apps/api/src/middleware/auth.ts
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return next(new AppError(401, 'Unauthorized'))

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return next(new AppError(401, 'Invalid or expired token'))

  req.user = user
  next()
}
```

`supabaseAdmin` uses the service role key and is defined in `apps/api/src/db/supabase.ts`. The resolved `user` object is attached to `req.user` and available to all downstream controllers and services.

### 11.2 Signup with 6-Digit OTP Verification

Signup is a multi-step flow that keeps the user on the same device and browser throughout, preventing the "device breakage" problem of magic link emails.

**Step 1 — Account creation (`/signup`)**

The browser calls `POST /api/v1/auth/signup` on the Express API with `{ email, password, display_name }`. The API validates the input with Zod, calls `supabaseAdmin.auth.signUp()` with `display_name` stored in `user_metadata`, performs a defensive profile upsert, and returns `{ email, userId }`. Supabase sends a **6-digit OTP** to the provided email.

```typescript
// apps/web/app/(auth)/signup/page.tsx
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/signup`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ email, password, display_name: displayName }),
})
const { userId } = await res.json()
setUserId(userId)
setView('verify') // flips to VerifyView in-component; URL stays at /signup
```

The URL remains `/signup` throughout — no navigation occurs. The returned `userId` is held in React state for use in the cancel flow (Step 3).

`display_name` is stored in `auth.users.raw_user_meta_data` via `options.data` in the `signUp()` call — it is not duplicated in the `profiles` table.

**Step 2 — OTP entry (VerifyView at `/signup`)**

The verify view is a component state transition within `signup/page.tsx` — not a separate page. `/signup/verify` exists only as a redirect stub for middleware matching and immediately redirects back to `/signup`. On OTP completion:

```typescript
// apps/web/app/(auth)/signup/page.tsx — VerifyView component
const supabase = createSupabaseBrowserClient()
const { error } = await supabase.auth.verifyOtp({
  email,
  token: otp,
  type:  'signup',
})
if (!error) {
  useUserStore.getState().actions.reset()
  router.push('/onboarding/level')
  router.refresh()
}
```

`supabase.auth.verifyOtp()` must be called from the browser so that `@supabase/ssr` can write session cookies into the browser's cookie jar. Calling it server-side via the Express API would return tokens as JSON without setting cookies, breaking the SSR session architecture.

**Step 3 — Passwordless Sign-In (v1.2)**

Users can log in without a password by requesting a 6-digit OTP sent to their registered email.

1.  Client calls `POST /api/v1/auth/login-otp` with `{ email }`.
2.  API calls `supabase.auth.signInWithOtp({ email })`.
3.  User enters OTP on the client.
4.  Client calls `supabase.auth.verifyOtp({ email, token, type: 'magiclink' })` (browser-side).

**Step 4 — Cancel signup (abandon OTP step)**

If the user presses "Go back" before verifying, the page fire-and-forgets `POST /api/v1/auth/cancel-signup` with `{ userId }` to delete the unconfirmed account, allowing a clean retry. The service guards against deleting confirmed accounts:

```typescript
// apps/api/src/services/auth.service.ts
export async function cancelSignup(input: CancelSignupInput): Promise<void> {
  const { data } = await supabaseAdmin.auth.admin.getUserById(input.userId)
  if (!data.user || data.user.email_confirmed_at) return
  await supabaseAdmin.auth.admin.deleteUser(input.userId)
}
```

**Step 4 — Profile initialization (Supabase trigger)**

A Supabase database trigger automatically inserts a `profiles` row when a new row is inserted into `auth.users` (i.e. immediately on `signUp()`, before OTP confirmation). The API also performs a defensive upsert after `signUp()` to handle any race where the trigger has not yet run:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 11.3 Login Flow

Standard email + password login is handled client-side via `supabase.auth.signInWithPassword()`. No Express endpoint is required:

```typescript
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (!error) router.push('/dashboard')
```

### 11.4 Logout

Logout calls the Express API to invalidate the current device session only:

```typescript
// POST /api/v1/auth/logout — auth.service.ts
export async function signOut(jwt: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(jwt, 'local')
  if (error) throw new AppError(500, 'Logout failed')
}
```

The `'local'` scope terminates only the session belonging to the supplied JWT. The user remains signed in on other devices.

### 11.5 Next.js Middleware (Session Refresh)

`apps/web/middleware.ts` uses `@supabase/ssr` to refresh session cookies on every request and redirect unauthenticated users:

```typescript
// Always getUser(), never getSession().
// getSession() reads a client-accessible cookie and can be spoofed.
// getUser() validates the JWT with Supabase server-side.
const { data: { user } } = await supabase.auth.getUser()
```

Routes matched by the middleware config:
- Protected routes (`/dashboard`, `/review`, `/decks`, `/analytics`, `/settings`, `/onboarding`) redirect to `/login` if `user` is null.
- Auth routes (`/login`, `/signup`, `/signup/verify`) redirect to `/dashboard` if `user` is already authenticated.

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

*End of TDD v1.3.0*

# Code Conventions & Style Guide
## AI-Enhanced FSRS for Japanese

**Version:** 1.0.0  
**Last Updated:** 2026-04-24

This document is the authoritative reference for all code style, naming, and structural conventions in this repository. Claude Code and all contributors must follow these conventions exactly. When in doubt, follow existing patterns in the codebase rather than inventing new ones.

---

## Table of Contents

1. [TypeScript](#1-typescript)
2. [File & Folder Naming](#2-file--folder-naming)
3. [React & Next.js Conventions](#3-react--nextjs-conventions)
4. [API Layer Conventions](#4-api-layer-conventions)
5. [Database & Supabase Conventions](#5-database--supabase-conventions)
6. [State Management Conventions](#6-state-management-conventions)
7. [CSS & Tailwind Conventions](#7-css--tailwind-conventions)
8. [Testing Conventions](#8-testing-conventions)
9. [Import Order](#9-import-order)
10. [Comments & Documentation](#10-comments--documentation)
11. [Git Conventions](#11-git-conventions)

---

## 1. TypeScript

### 1.1 Strictness

All packages use `"strict": true`. Additional strict flags enabled:

```jsonc
// packages/tsconfig/base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

Never disable these with `@ts-ignore` or `@ts-expect-error` without a comment explaining why. `@ts-ignore` is banned by ESLint. `@ts-expect-error` is allowed only when testing intentional type errors.

### 1.2 Type vs Interface

Use `interface` for object shapes that represent entities or contracts. Use `type` for unions, intersections, mapped types, and aliases.

```typescript
// ✅ Use interface for entity shapes
interface Card {
  id: string
  word: string
  reading: string
  meaning: string
}

// ✅ Use type for unions and computed types
type CardType = 'recognition' | 'production' | 'reading' | 'audio' | 'grammar'
type CardWithDeck = Card & { deck: Deck }
type PartialCard = Partial<Pick<Card, 'reading' | 'meaning'>>

// ❌ Don't use type for plain object shapes that could be interfaces
type Card = {
  id: string
  word: string
}
```

### 1.3 Enums

Do not use TypeScript `enum`. Use `as const` objects instead — they compile to plain objects and produce better error messages.

```typescript
// ✅ Correct
const CardStatus = {
  New: 'new',
  Learning: 'learning',
  Review: 'review',
  Relearning: 'relearning',
  Suspended: 'suspended',
} as const
type CardStatus = typeof CardStatus[keyof typeof CardStatus]

// ❌ Avoid
enum CardStatus {
  New = 'new',
  Learning = 'learning',
}
```

### 1.4 Null vs Undefined

- Database nullable fields are typed as `T | null` (SQL NULL)
- Optional function parameters and object properties use `T | undefined` (or `?:`)
- Never use `T | null | undefined` — pick one nullability form per context
- Use `??` (nullish coalescing) not `||` for null/undefined defaults, since `||` swallows falsy values like `0` and `""`

```typescript
// ✅
const display = card.reading ?? card.word
const limit = options?.limit ?? 20

// ❌ — swallows 0
const limit = options?.limit || 20
```

### 1.5 Assertions

Never use `!` non-null assertion on values that come from the database or API. Use explicit null checks or early returns.

```typescript
// ✅
const user = await getUser(id)
if (!user) throw new AppError('NOT_FOUND', 'User not found')
doSomething(user) // TypeScript knows user is non-null here

// ❌
const user = await getUser(id)
doSomething(user!) // Hides runtime errors
```

### 1.6 Generics

Name generic parameters descriptively when the usage context isn't obvious from a single letter.

```typescript
// ✅ Single-letter is fine when obvious
function identity<T>(value: T): T { return value }

// ✅ Descriptive when context is complex
function createQueryHook<TData, TError = AppError>(
  queryFn: () => Promise<TData>
): UseQueryResult<TData, TError>

// ❌ Single-letter when meaning is unclear
function mapResponse<T, U, V>(input: T, transform: (a: U) => V): V
```

### 1.7 Return Types

Always annotate the return type of exported functions and all async functions. Omit for short, obviously-typed private functions.

```typescript
// ✅ Annotate exported and async
export function buildCardKey(deckId: string, word: string): string {
  return `${deckId}:${word}`
}

async function fetchCard(id: string): Promise<Card> {
  ...
}

// ✅ Omit for obvious short private functions
const toUpperCase = (s: string) => s.toUpperCase()
```

---

## 2. File & Folder Naming

### 2.1 General Rules

| Context | Convention | Example |
|---|---|---|
| React components | PascalCase | `ReviewCard.tsx` |
| Hooks | camelCase with `use` prefix | `useReviewSession.ts` |
| Utility functions | camelCase | `formatInterval.ts` |
| Constants | camelCase for files, SCREAMING_SNAKE for values | `constants.ts`, `MAX_LEECHES` |
| Types/interfaces file | camelCase with `.types.ts` suffix | `card.types.ts` |
| API route files | camelCase | `cards.ts` |
| Controller files | camelCase with `.controller.ts` suffix | `auth.controller.ts` |
| Service files | camelCase with `.service.ts` suffix | `fsrs.service.ts` |
| Test files | Same name as subject with `.test.ts` suffix | `fsrs.service.test.ts` |
| Directories | kebab-case | `shared-types/` |

### 2.2 Component File Colocation

Each non-trivial component gets its own directory with colocated files:

```
components/review/ReviewCard/
├── ReviewCard.tsx          ← Component
├── ReviewCard.test.tsx     ← Tests
├── ReviewCard.types.ts     ← Local types (if complex enough)
└── index.ts                ← Re-export: export { ReviewCard } from './ReviewCard'
```

Simple single-file components (< 80 lines, no local types) can live directly as `ReviewCard.tsx` without a directory.

### 2.3 Next.js App Router Specific

- Page files are always `page.tsx`
- Layout files are always `layout.tsx`
- Loading files are always `loading.tsx`
- Error boundaries are always `error.tsx`
- Never name a route segment file anything other than the Next.js reserved names

---

## 3. React & Next.js Conventions

### 3.1 Component Structure Order

Every component file follows this internal order:

```typescript
// 1. Imports (see §9 for order)
import { useState } from 'react'
import { Card } from '@/types'

// 2. Local types (only if not in a .types.ts file)
interface ReviewCardProps {
  card: Card
  onRate: (rating: Rating) => void
}

// 3. Constants local to this component
const SWIPE_THRESHOLD = 80

// 4. Component (default export last)
export function ReviewCard({ card, onRate }: ReviewCardProps) {
  // 4a. Hooks (all hooks at the top)
  const [isFlipped, setIsFlipped] = useState(false)
  const { data } = useQuery(...)
  
  // 4b. Derived state / memos
  const displayWord = card.reading ?? card.word
  
  // 4c. Handlers
  const handleFlip = () => setIsFlipped(true)
  
  // 4d. Effects (at the end of hook declarations)
  useEffect(() => { ... }, [])
  
  // 4e. Early returns (loading, error, empty)
  if (!card) return null
  
  // 4f. Render
  return (
    <div>...</div>
  )
}
```

### 3.2 Props

- Destructure props in the function signature, never access via `props.x`
- Boolean props that are `true` should use shorthand: `<Button disabled />` not `<Button disabled={true} />`
- Default props are set via destructuring defaults: `function Foo({ limit = 20 }: Props)`
- Callback props are named `onX` (e.g. `onRate`, `onClose`, `onCardFlip`)

### 3.3 Server vs Client Components

Next.js 15 defaults to Server Components. Add `'use client'` only when the component:
- Uses React state (`useState`, `useReducer`)
- Uses React effects (`useEffect`, `useLayoutEffect`)
- Uses browser-only APIs (`window`, `document`, `localStorage`)
- Uses event handlers directly on DOM elements
- Uses a client-only third-party library

Do not add `'use client'` preemptively. Push `'use client'` as far down the tree as possible to maximize server-rendered surface area.

```typescript
// ✅ Server component (no directive needed)
// app/(app)/decks/page.tsx
export default async function DecksPage() {
  const decks = await fetchDecks() // Direct DB call
  return <DeckList decks={decks} />
}

// ✅ Client component — only the interactive part
// components/decks/DeckList.tsx
'use client'
export function DeckList({ decks }: { decks: Deck[] }) {
  const [filter, setFilter] = useState<DeckType | 'all'>('all')
  ...
}
```

### 3.4 Data Fetching

- Server components fetch directly via service functions or Supabase client (server-side)
- Client components fetch via TanStack Query hooks — never via `useEffect` + `fetch`
- Mutations use TanStack Query's `useMutation` — never manual `useState` loading flags

```typescript
// ✅ Client-side data fetching
function DeckDetail({ deckId }: { deckId: string }) {
  const { data: deck, isLoading } = useQuery({
    queryKey: ['decks', deckId],
    queryFn: () => api.decks.getById(deckId),
  })
  ...
}

// ❌ Never do this
function DeckDetail({ deckId }: { deckId: string }) {
  const [deck, setDeck] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch(`/api/decks/${deckId}`).then(r => r.json()).then(setDeck)
  }, [deckId])
}
```

### 3.5 Keys in Lists

Always use stable, unique IDs as keys — never array indices.

```typescript
// ✅
cards.map(card => <CardItem key={card.id} card={card} />)

// ❌
cards.map((card, i) => <CardItem key={i} card={card} />)
```

### 3.6 Japanese Text Rendering

Always use the `<FuriganaText>` component for any Japanese text that may contain kanji with readings. Never output raw `<ruby>` tags elsewhere.

Always apply `lang="ja"` to Japanese text containers:
```typescript
<p lang="ja" className="font-japanese">
  <FuriganaText text="木漏れ日[こもれび]" />
</p>
```

---

## 4. API Layer Conventions

### 4.1 Route Handler Structure

The API uses a three-layer architecture: **routes → controllers → services**.

| Layer | File | Responsibility |
|---|---|---|
| Route | `routes/cards.ts` | Declare path + method, apply middleware, delegate to controller |
| Controller | `controllers/cards.controller.ts` | Validate request, call service, send response |
| Service | `services/card.service.ts` | Business logic, DB queries — no `req`/`res` |

```typescript
// ✅ routes/cards.ts — path mapping only
router.post('/', authMiddleware, rateLimitMiddleware, cardsController.create)

// ✅ controllers/cards.controller.ts — request/response handling
export const create: RequestHandler = async (req, res, next) => {
  try {
    const body = createCardSchema.parse(req.body)
    const card = await cardService.create(req.params['deckId']!, req.user.id, body)
    res.status(201).json(card)
  } catch (err) {
    next(err)
  }
}

// ✅ services/card.service.ts — business logic only
export async function create(deckId: string, userId: string, input: CreateCardInput): Promise<Card> {
  // DB queries, FSRS logic, etc. — no req/res imports
}

// ❌ Wrong: business logic inside a route handler
router.post('/', async (req, res) => {
  const existing = await supabase.from('cards').select().eq('word', req.body.word)
  if (existing.data?.length) {
    return res.status(409).json({ error: 'Card already exists' })
  }
  // ... 50 more lines
})
```

Controllers never import from `express` beyond `RequestHandler` (the type). They never call `supabaseAdmin` directly — all DB access goes through services.

### 4.2 Request Validation

All request bodies are validated with Zod schemas. Schemas live in `apps/api/src/schemas/` and are imported by both the route handler and exported via `packages/shared-types` for frontend use.

```typescript
// apps/api/src/schemas/card.schema.ts
import { z } from 'zod'

export const createCardSchema = z.object({
  word: z.string().min(1).max(100),
  deckId: z.string().uuid(),
  reading: z.string().optional(),
  meaning: z.string().min(1).max(500),
})

export type CreateCardInput = z.infer<typeof createCardSchema>
```

Validation errors are caught by the global error handler and formatted as `400 Bad Request` with Zod's error details.

### 4.3 Response Shape

All API responses follow a consistent shape. Success responses return the data directly (no wrapper):

```json
// ✅ Success — return data directly
{ "id": "uuid", "word": "木漏れ日", "meaning": "..." }

// ✅ Success list
{ "items": [...], "total": 320, "page": 1, "pageSize": 20 }

// ❌ Don't wrap in { success: true, data: {...} }
{ "success": true, "data": { "id": "uuid" } }
```

Error responses always use the standard error shape (see `ERROR-HANDLING.md`).

### 4.4 HTTP Status Codes

| Situation | Code |
|---|---|
| Successful GET / POST returning data | 200 |
| Successful POST creating a resource | 201 |
| Successful DELETE or action with no body | 204 |
| Validation error | 400 |
| Missing or invalid auth token | 401 |
| Valid token but insufficient permissions | 403 |
| Resource not found | 404 |
| Duplicate / conflict (e.g. duplicate card) | 409 |
| AI rate limit exceeded | 429 |
| Unexpected server error | 500 |

### 4.5 Pagination

List endpoints that can return > 50 items use cursor-based pagination:

```typescript
// Query params
GET /api/v1/decks/:id/cards?limit=20&cursor=<uuid>

// Response
{
  "items": [...],
  "nextCursor": "uuid-of-last-item" | null,
  "hasMore": true | false
}
```

Never use offset-based pagination (`?page=2`). It produces inconsistent results when cards are added/removed between requests.

---

## 5. Database & Supabase Conventions

### 5.1 Migration Files

Migration files are in `supabase/migrations/` and named:

```
YYYYMMDDHHMMSS_short_description.sql
```

Example: `20260424120000_add_premade_decks.sql`

Rules:
- One migration per logical change
- Migrations must be idempotent where possible (`CREATE TABLE IF NOT EXISTS`)
- Never modify a migration that has been pushed to any shared environment — create a new one
- Every migration that creates a table must also add its RLS policy in the same file

### 5.2 Supabase Client Usage

Two Supabase clients exist and must not be confused:

```typescript
// apps/api/src/db/supabase.ts

// Server client — uses SERVICE ROLE KEY. Bypasses RLS. 
// ONLY for server-side operations where you have already verified auth.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// apps/web/lib/supabase/client.ts
// Browser client — uses ANON KEY. Subject to RLS.
// For auth session management only.
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

The browser client is **only** used for auth (sign in, sign out, session refresh). All data queries go through the Express API, not directly from the browser to Supabase.

### 5.3 Query Patterns

```typescript
// ✅ Always check for errors after Supabase queries
const { data, error } = await supabaseAdmin
  .from('cards')
  .select('id, word, meaning')
  .eq('user_id', userId)
  .order('due', { ascending: true })
  .limit(50)

if (error) throw new DatabaseError(error.message)
if (!data) return []

// ❌ Never swallow the error
const { data } = await supabaseAdmin.from('cards').select()
return data ?? []
```

### 5.4 Column Selection

Always specify the columns you need in `.select()`. Never use `.select('*')` in production code — it wastes bandwidth and creates implicit dependencies.

```typescript
// ✅
.select('id, word, reading, meaning, due, status')

// ❌
.select('*')
```

### 5.5 Naming

- Table names: `snake_case`, plural (`cards`, `review_logs`, `premade_decks`)
- Column names: `snake_case` (`user_id`, `created_at`, `jlpt_level`)
- Index names: `{table}_{columns}_idx` (`cards_user_due_idx`)
- Constraint names: `{table}_{column}_{type}` (`cards_user_id_fkey`)
- Migration descriptions: imperative present tense (`add_premade_decks`, `add_embedding_to_cards`)

---

## 6. State Management Conventions

### 6.1 Zustand Store Conventions

Every store follows this exact structure:

```typescript
// stores/useReviewSessionStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Card, Rating } from '@fsrs-japanese/shared-types'

// 1. State interface (data only)
interface ReviewSessionState {
  queue: Card[]
  currentIndex: number
  showAnswer: boolean
  completed: ReviewResult[]
}

// 2. Actions interface (functions only)
interface ReviewSessionActions {
  startSession: (cards: Card[]) => void
  flipCard: () => void
  submitRating: (rating: Rating) => void
  reset: () => void
}

// 3. Combined store type
type ReviewSessionStore = ReviewSessionState & { actions: ReviewSessionActions }

// 4. Initial state as a constant
const initialState: ReviewSessionState = {
  queue: [],
  currentIndex: 0,
  showAnswer: false,
  completed: [],
}

// 5. Store creation
export const useReviewSessionStore = create<ReviewSessionStore>()(
  devtools(
    (set, get) => ({
      ...initialState,
      actions: {
        startSession: (cards) => set({ queue: cards, currentIndex: 0 }),
        flipCard: () => set({ showAnswer: true }),
        submitRating: (rating) => {
          const { currentIndex, queue } = get()
          set({
            currentIndex: currentIndex + 1,
            showAnswer: false,
            completed: [...get().completed, { card: queue[currentIndex]!, rating }],
          })
        },
        reset: () => set(initialState),
      },
    }),
    { name: 'ReviewSessionStore' }
  )
)

// 6. Selector hooks (never select the whole store)
export const useReviewQueue = () => useReviewSessionStore(s => s.queue)
export const useCurrentCard = () => useReviewSessionStore(s => s.queue[s.currentIndex])
export const useSessionActions = () => useReviewSessionStore(s => s.actions)
```

Rules:
- Actions live inside `actions: {}` — never at the top level of the store
- Selectors are exported as named hooks — components never call `useStore(s => s)` to get the whole store
- The `devtools` middleware is always applied in development for Redux DevTools support
- `reset()` action must exist on every store and restore `initialState`
- Stores are named in `devtools` config for debuggability

### 6.2 TanStack Query Conventions

**Query key factory pattern.** All query keys are defined in a central factory file:

```typescript
// lib/api/queryKeys.ts
export const queryKeys = {
  decks: {
    all: () => ['decks'] as const,
    list: () => [...queryKeys.decks.all(), 'list'] as const,
    detail: (id: string) => [...queryKeys.decks.all(), 'detail', id] as const,
  },
  cards: {
    all: () => ['cards'] as const,
    byDeck: (deckId: string) => [...queryKeys.cards.all(), 'deck', deckId] as const,
    detail: (id: string) => [...queryKeys.cards.all(), 'detail', id] as const,
    similar: (id: string) => [...queryKeys.cards.all(), 'similar', id] as const,
  },
  reviews: {
    due: () => ['reviews', 'due'] as const,
    forecast: () => ['reviews', 'forecast'] as const,
  },
  analytics: {
    heatmap: () => ['analytics', 'heatmap'] as const,
    accuracy: () => ['analytics', 'accuracy'] as const,
    jlptGap: () => ['analytics', 'jlpt-gap'] as const,
  },
} as const
```

Every `useQuery` and `useMutation` call uses these factory functions — never hardcoded strings.

**Stale times:**

```typescript
// lib/api/config.ts
export const staleTimes = {
  dueCards: 1000 * 60 * 5,      // 5 min — changes after reviews
  deckList: 1000 * 60 * 10,     // 10 min
  cardDetail: 1000 * 60 * 30,   // 30 min — content rarely changes
  analytics: 1000 * 60 * 60,    // 1 hour
  forecast: 1000 * 60 * 15,     // 15 min
} as const
```

---

## 7. CSS & Tailwind Conventions

### 7.1 Class Ordering

Tailwind classes follow this order (enforced by `prettier-plugin-tailwindcss`):
1. Layout (display, position, z-index)
2. Box model (width, height, padding, margin)
3. Typography
4. Visual (background, border, shadow, ring)
5. Interactive (cursor, select, transition)
6. Responsive modifiers last

### 7.2 Conditional Classes

Use the `clsx` / `cn` utility (never string concatenation):

```typescript
import { cn } from '@/lib/utils'

// ✅
<button className={cn(
  'flex items-center justify-center rounded-md font-medium transition-colors',
  variant === 'primary' && 'bg-primary-500 text-white hover:bg-primary-600',
  variant === 'ghost' && 'text-text-secondary hover:bg-surface-inset',
  disabled && 'opacity-40 cursor-not-allowed',
  className,
)}>

// ❌
<button className={`flex items-center ${variant === 'primary' ? 'bg-primary-500' : ''}`}>
```

### 7.3 Design Tokens in CSS

Use CSS custom properties (design tokens) for colors, never hardcoded hex values in Tailwind classes:

```typescript
// ✅ Use semantic token classes defined in globals.css
<div className="bg-surface-raised text-text-primary border-border-subtle">

// ❌ Never hardcode colors
<div className="bg-white text-gray-900 border-gray-200">
```

The `globals.css` file defines all token classes as Tailwind utilities via `@layer utilities`.

### 7.4 Japanese Font Class

A custom Tailwind utility class `font-japanese` applies the Noto Sans JP font stack:

```css
/* globals.css */
@layer utilities {
  .font-japanese {
    font-family: 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif;
  }
}
```

Always use `font-japanese` on any element containing Japanese text — never set the font-family inline.

---

## 8. Testing Conventions

See `TESTING.md` for full testing strategy. Summary of conventions:

- Test files live next to their subject: `ReviewCard.test.tsx` beside `ReviewCard.tsx`
- Use Bun's built-in test runner (`bun test`)
- Use `@testing-library/react` for component tests
- Mock the API layer at the TanStack Query / fetch boundary, not at the service layer
- Never test implementation details — test behavior and output
- Test IDs use `data-testid="kebab-case-name"` — only on elements that cannot be targeted by accessible roles

---

## 9. Import Order

ESLint enforces this import order (via `eslint-plugin-import`):

```typescript
// 1. Node built-ins (api only)
import path from 'path'

// 2. External packages
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

// 3. Internal packages (monorepo)
import type { Card } from '@fsrs-japanese/shared-types'

// 4. Internal absolute imports (path aliases)
import { ReviewCard } from '@/components/review/ReviewCard'
import { useReviewSessionStore } from '@/stores/useReviewSessionStore'
import { api } from '@/lib/api'

// 5. Relative imports
import { formatInterval } from './utils'
import type { ReviewCardProps } from './ReviewCard.types'

// Blank line between each group
```

Path aliases configured in `tsconfig.json`:
- `@/*` → `apps/web/src/*`
- `@api/*` → `apps/api/src/*`
- `@fsrs-japanese/*` → `packages/*/src`

---

## 10. Comments & Documentation

### 10.1 When to Comment

Comment the *why*, not the *what*. Code explains what it does. Comments explain why it does it that way.

```typescript
// ✅ Explains non-obvious reasoning
// FSRS requires all sibling card types to share the same parent_card_id
// so weakness analysis can correlate failures across recognition/production
const parentId = await findOrCreateParentCard(word, deckId)

// ✅ Marks intentional deviation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Supabase realtime payload type is not exported from their SDK
const payload = event.new as any

// ❌ Restates the code
// Set the card status to 'new'
card.status = 'new'
```

### 10.2 JSDoc

Use JSDoc for all exported functions and service methods. Minimum: one-line description. Add `@param` and `@returns` when the types alone are not self-documenting.

```typescript
/**
 * Processes a review rating and updates the card's FSRS scheduling state.
 * Also checks for leech conditions and fires diagnosis if threshold is met.
 *
 * @param cardId - UUID of the card being reviewed
 * @param rating - FSRS Rating enum value (Again=1, Hard=2, Good=3, Easy=4)
 * @param userId - Authenticated user's ID (for ownership verification)
 * @returns Updated card with new scheduling state
 */
export async function processReview(
  cardId: string,
  rating: Rating,
  userId: string
): Promise<Card> { ... }
```

### 10.3 TODO Format

```typescript
// TODO(username): Short description of what needs to be done
// TODO(alex): Replace hardcoded leech threshold with user preference setting

// FIXME(username): Description of the bug
// HACK: One-line explanation of why this workaround exists
```

---

## 11. Git Conventions

### 11.1 Branch Naming

```
feature/short-description
fix/short-description
chore/short-description
docs/short-description
refactor/short-description
```

### 11.2 Commit Messages

Follow Conventional Commits:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `style`

Scopes: `api`, `web`, `db`, `ai`, `fsrs`, `auth`, `shared`

```
feat(api): add AI card generation endpoint with Zod validation
fix(fsrs): prevent double review submission on network retry
chore(db): add index on cards.user_id and cards.due
docs(api): add JSDoc to processReview service method
```

- Subject line: ≤ 72 characters, imperative mood, no period
- Reference issue numbers in footer: `Closes #42`

---

*End of CONVENTIONS.md v1.0.0*

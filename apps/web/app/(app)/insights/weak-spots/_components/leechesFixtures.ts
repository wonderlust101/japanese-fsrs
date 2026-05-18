import type {
  ApiLeechListItem,
  ApiLeechListResponse,
} from '@fsrs-japanese/shared-types'

/**
 * Dev fixtures for the leeches page. Each builder returns a list-shaped
 * envelope so the view's consumer code is identical whether it's reading
 * from the network or from a fixture. Mirrors the Mistakes fixture pattern.
 *
 * These are wired only when `process.env.NODE_ENV === 'development'`. The
 * production bundle never executes the fixture branch in `leeches-view.tsx`.
 */

const NOW = '2026-05-17T12:00:00.000Z'

function days(daysAgo: number): string {
  const date = new Date(NOW)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString()
}

function leech(
  id: string,
  overrides: Partial<ApiLeechListItem> = {},
): ApiLeechListItem {
  return {
    id,
    cardId:       'c-' + id,
    deckId:       'd-core',
    deckName:     'Core 2k',
    word:         '見送る',
    reading:      'みおくる',
    meaning:      'to see off; to escort',
    layoutType:   'vocabulary',
    jlptLevel:    'N4',
    lapses:       8,
    reps:         22,
    due:          days(-1),
    lastReview:   days(2),
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    resolvedAt:   null,
    createdAt:    days(14),
    ...overrides,
  }
}

function envelope(items: ApiLeechListItem[]): ApiLeechListResponse {
  return { items, nextCursor: null, hasMore: false }
}

export function buildCleanFixture(): ApiLeechListResponse {
  return envelope([])
}

export function buildFewFixture(): ApiLeechListResponse {
  return envelope([
    leech('l1', { word: '見送る', reading: 'みおくる', meaning: 'to see off',  lapses: 8 }),
    leech('l2', {
      word: '預ける', reading: 'あずける', meaning: 'to entrust; to deposit',
      lapses: 6, jlptLevel: 'N3', deckName: 'JLPT N3 vocab',
      deckId: 'd-n3',
    }),
    leech('l3', {
      word: '果たして', reading: 'はたして', meaning: 'really; sure enough',
      lapses: 5, jlptLevel: 'N2', deckName: 'Reading practice', deckId: 'd-reading',
    }),
  ])
}

export function buildManyFixture(): ApiLeechListResponse {
  return envelope([
    leech('l1', { word: '見送る',     reading: 'みおくる',   meaning: 'to see off',                lapses: 12 }),
    leech('l2', { word: '預ける',     reading: 'あずける',   meaning: 'to entrust',                lapses: 9,
                  jlptLevel: 'N3', deckName: 'JLPT N3 vocab', deckId: 'd-n3' }),
    leech('l3', { word: '果たして',   reading: 'はたして',   meaning: 'really; sure enough',       lapses: 7,
                  jlptLevel: 'N2', deckName: 'Reading practice', deckId: 'd-reading' }),
    leech('l4', { word: '相次ぐ',     reading: 'あいつぐ',   meaning: 'to happen in succession',   lapses: 6,
                  jlptLevel: 'N2', deckName: 'News vocab', deckId: 'd-news',
                  diagnosis:    'Reading conflict with 相継ぐ; the visual stem 「相」 trips comprehension.',
                  prescription: 'Add a contrast card pairing 相次ぐ with 相継ぐ and a sentence anchor.' }),
    leech('l5', { word: 'まちまち',   reading: 'まちまち',   meaning: 'varied; mixed',             lapses: 5,
                  jlptLevel: 'N2', deckName: 'Casual', deckId: 'd-casual' }),
    leech('l6', { word: '振る舞う',   reading: 'ふるまう',   meaning: 'to behave; to treat (food)', lapses: 6,
                  jlptLevel: 'N2' }),
    leech('l7', { word: '取り立てて', reading: 'とりたてて', meaning: 'particularly; especially',  lapses: 8,
                  jlptLevel: 'N1' }),
  ])
}

export function buildResolvedFixture(): ApiLeechListResponse {
  return envelope([
    leech('lr1', {
      word: '案内',  reading: 'あんない', meaning: 'guidance; information',
      lapses: 4, resolved: true, resolvedAt: days(2),
    }),
    leech('lr2', {
      word: '取り組む', reading: 'とりくむ', meaning: 'to tackle (a problem)',
      lapses: 5, resolved: true, resolvedAt: days(7),
      jlptLevel: 'N3', deckName: 'JLPT N3 vocab', deckId: 'd-n3',
    }),
  ])
}

export function buildOrphanFixture(): ApiLeechListResponse {
  return envelope([
    leech('lo1', {
      cardId: null, deckId: null, deckName: null,
      word: null, reading: null, meaning: null,
      layoutType: null, jlptLevel: null,
      lapses: null, reps: null, due: null, lastReview: null,
    }),
    leech('lo2'),
  ])
}

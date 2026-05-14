/**
 * Sketch-fidelity stub data for the per-section profile variants. Every
 * variant within a section reads the same data so toggling compares
 * renderings, not numbers. Deterministic (no Math.random) so a page
 * reload renders the identical pattern.
 *
 * When the public-profile schema lands (handle, bio, location,
 * decks.is_public, profiles.public_recent_reviews), this file gets
 * deleted and the variants wire to real services.
 */

export interface StubCadenceDay {
  /** Days ago from today (0 = today, 364 = oldest in view). */
  daysAgo: number
  /** 0 = no practice, 1-3 = practice intensity (drives shade). */
  intensity: 0 | 1 | 2 | 3
}

export interface StubRetention {
  comprehension: number
  production:    number
  listening:     number
}

export interface StubCurrently {
  word:     string
  reading:  string
  meaning:  string
  deckName: string
  jlpt:     'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond'
  seenIn:   number
  total:    number
  /** Example sentence in which the word appears (for sentence-led variant). */
  sentence: { ja: string; en: string }
  /** True when this deck is the owner's private (un-shared) practice. The
   *  Cu2 deck-led variant surfaces this with a lock affordance so a public
   *  visitor sees the deck name + progress but not its internal cards. */
  isPrivate: boolean
}

export interface StubSharedDeck {
  id:        string
  name:      string
  subtitle:  string
  cardCount: number
  jlpt:      'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond' | null
}

export interface ProfileStubData {
  handle:         string
  bio:            string
  location:       string
  /** The learner's first language. Used in the Basic Info section to
   *  give visitors context for their study direction. */
  nativeLanguage: string
  /** Free-text "why I'm studying" sentence. Surfaces in Basic Info so
   *  the profile communicates motivation alongside metadata. */
  studyPurpose:   string
  cadence:        StubCadenceDay[]
  retention:      StubRetention
  currently:      StubCurrently
  shelf:          StubSharedDeck[]
}

/**
 * Deterministic cadence: 365 days of practice intensities. Pattern is a
 * gentle sine wave (study cycles wax and wane over weeks) with a
 * threshold cutoff so ~33% of days register as no practice. Renders
 * around 240 practiced days out of 365 — a serious-but-not-perfect
 * cadence, matching the "encouraging, not shaming" brand voice.
 */
function buildCadence(): StubCadenceDay[] {
  const days: StubCadenceDay[] = []
  for (let i = 0; i < 365; i += 1) {
    const wave = Math.sin((i / 365) * Math.PI * 4) * 0.4 + 0.45
    const noise = Math.sin(i * 12.9898) * 0.5 + 0.5
    const value = wave * 0.7 + noise * 0.3
    if (value < 0.32) {
      days.push({ daysAgo: 364 - i, intensity: 0 })
    } else if (value < 0.55) {
      days.push({ daysAgo: 364 - i, intensity: 1 })
    } else if (value < 0.78) {
      days.push({ daysAgo: 364 - i, intensity: 2 })
    } else {
      days.push({ daysAgo: 364 - i, intensity: 3 })
    }
  }
  return days
}

export function buildProfileStubData(displayName: string): ProfileStubData {
  const handle = displayName.toLowerCase().replace(/\s+/g, '.')

  return {
    handle,
    bio:            'Quietly working through manga and conversational Japanese, one morning at a time.',
    location:       'Tokyo',
    nativeLanguage: 'English',
    studyPurpose:   'Reading manga and holding everyday conversations',
    cadence:        buildCadence(),
    retention: {
      comprehension: 91,
      production:    87,
      listening:     79,
    },
    currently: {
      word:     '食べる',
      reading:  'たべる',
      meaning:  'to eat',
      deckName: 'Morning ritual',
      jlpt:     'N5',
      seenIn:   17,
      total:    42,
      sentence: {
        ja: '朝ごはんを食べてから出かけます。',
        en: 'I head out after I eat breakfast.',
      },
      isPrivate: true,
    },
    shelf: [
      { id: 'shelf-manga',    name: 'Manga vocab from BLEACH',     subtitle: 'Action verbs, shonen idioms',        cardCount: 182, jlpt: 'N3'     },
      { id: 'shelf-office',   name: 'Office expressions',          subtitle: 'Meetings, email, polite forms',      cardCount: 64,  jlpt: 'N3'     },
      { id: 'shelf-beyond',   name: 'Beyond JLPT: literary verbs', subtitle: 'Novels and essays',                  cardCount: 421, jlpt: 'beyond' },
      { id: 'shelf-onomato',  name: 'Onomatopoeia in fiction',     subtitle: 'Mimetic words from short stories',   cardCount: 96,  jlpt: 'N2'     },
      { id: 'shelf-news',     name: 'NHK Easy News core',          subtitle: 'Daily-headline vocabulary',          cardCount: 240, jlpt: 'N3'     },
      { id: 'shelf-keigo',    name: 'Keigo for service work',      subtitle: 'Formal and humble registers',        cardCount: 118, jlpt: 'N2'     },
      { id: 'shelf-counters', name: 'Counters worth memorising',   subtitle: 'The thirty you actually meet',       cardCount: 38,  jlpt: 'N4'     },
    ],
  }
}

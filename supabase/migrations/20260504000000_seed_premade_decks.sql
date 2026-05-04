-- ============================================================
-- Seed: 8 premade decks + ~10 sample cards each (~80 cards total)
-- Idempotent: stable UUIDs + ON CONFLICT DO NOTHING.
-- Premade source cards have user_id IS NULL, deck_id IS NULL,
-- premade_deck_id set — per the cards_deck_xor_premade constraint.
-- ============================================================

-- ─── Premade decks ────────────────────────────────────────────────────────────
INSERT INTO premade_decks (id, name, description, deck_type, jlpt_level, domain, is_active)
VALUES
  ('11111111-1111-4111-8111-000000000005',
   'JLPT N5 Vocabulary',
   'Essential vocabulary for the JLPT N5 exam.',
   'vocabulary', 'N5', NULL, TRUE),
  ('11111111-1111-4111-8111-000000000004',
   'JLPT N4 Vocabulary',
   'Core vocabulary for the JLPT N4 exam.',
   'vocabulary', 'N4', NULL, TRUE),
  ('11111111-1111-4111-8111-000000000003',
   'JLPT N3 Vocabulary',
   'Intermediate vocabulary for the JLPT N3 exam.',
   'vocabulary', 'N3', NULL, TRUE),
  ('11111111-1111-4111-8111-000000000002',
   'JLPT N2 Vocabulary',
   'Upper-intermediate vocabulary for the JLPT N2 exam.',
   'vocabulary', 'N2', NULL, TRUE),
  ('11111111-1111-4111-8111-000000000001',
   'JLPT N1 Vocabulary',
   'Advanced vocabulary for the JLPT N1 exam.',
   'vocabulary', 'N1', NULL, TRUE),
  ('22222222-2222-4222-8222-000000000001',
   'JLPT N5–N1 Grammar',
   'Foundational grammar patterns covering JLPT N5 through N1.',
   'grammar', NULL, 'jlpt', TRUE),
  ('33333333-3333-4333-8333-000000000001',
   'Joyo Kanji Grade 1–6',
   'The 1,026 Joyo kanji taught in Japanese elementary school.',
   'kanji', NULL, 'joyo', TRUE),
  ('44444444-4444-4444-8444-000000000001',
   'Beyond JLPT Core',
   'Native-level and domain-specific vocabulary not on any JLPT list.',
   'vocabulary', 'beyond_jlpt', NULL, TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── Helper: idempotent card seed ─────────────────────────────────────────────
-- Each card uses a stable UUID, premade_deck_id set, deck_id and user_id NULL.
-- fields_data follows the GeneratedCardDataSchema shape so the existing card
-- detail UI renders without changes.

-- ── N5 Vocabulary ─────────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('a0000005-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"水","reading":"みず","meaning":"water","partOfSpeech":"noun","exampleSentences":[{"ja":"水を飲みます。","en":"I drink water.","furigana":"みずをのみます。"}],"mnemonic":"Three flowing strokes — picture rain pouring."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"火","reading":"ひ","meaning":"fire","partOfSpeech":"noun","exampleSentences":[{"ja":"火が熱い。","en":"The fire is hot.","furigana":"ひがあつい。"}],"mnemonic":"Two arms thrown up around a flame."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"食べる","reading":"たべる","meaning":"to eat","partOfSpeech":"verb (ichidan)","exampleSentences":[{"ja":"りんごを食べる。","en":"I eat an apple.","furigana":"りんごをたべる。"}],"mnemonic":"Roof over a plate — eating under shelter."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"飲む","reading":"のむ","meaning":"to drink","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"お茶を飲みます。","en":"I drink tea.","furigana":"おちゃをのみます。"}],"mnemonic":"Mouth (口) on the left swallowing."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000005', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"行く","reading":"いく","meaning":"to go","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"学校に行く。","en":"I go to school.","furigana":"がっこうにいく。"}],"mnemonic":"Roads crossing — picture an intersection."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000006', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"見る","reading":"みる","meaning":"to see / to watch","partOfSpeech":"verb (ichidan)","exampleSentences":[{"ja":"映画を見る。","en":"I watch a movie.","furigana":"えいがをみる。"}],"mnemonic":"An eye (目) on legs walking around looking."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000007', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"学校","reading":"がっこう","meaning":"school","partOfSpeech":"noun","exampleSentences":[{"ja":"学校は近い。","en":"The school is nearby.","furigana":"がっこうはちかい。"}],"mnemonic":"「学」learn + 「校」building."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000008', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"猫","reading":"ねこ","meaning":"cat","partOfSpeech":"noun","exampleSentences":[{"ja":"猫がかわいい。","en":"The cat is cute.","furigana":"ねこがかわいい。"}],"mnemonic":"Beast radical + 「苗」 — a small beast."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000009', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"犬","reading":"いぬ","meaning":"dog","partOfSpeech":"noun","exampleSentences":[{"ja":"犬と歩く。","en":"I walk with the dog.","furigana":"いぬとあるく。"}],"mnemonic":"Big (大) with a tail — a dog wagging."}'::jsonb),
  ('a0000005-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000005', 'vocabulary', 'comprehension', 'N5',
   '{"word":"本","reading":"ほん","meaning":"book","partOfSpeech":"noun","exampleSentences":[{"ja":"本を読む。","en":"I read a book.","furigana":"ほんをよむ。"}],"mnemonic":"Tree (木) with roots — origin/source becomes \"book\"."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── N4 Vocabulary ─────────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('a0000004-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"地図","reading":"ちず","meaning":"map","partOfSpeech":"noun","exampleSentences":[{"ja":"地図を見る。","en":"I look at the map.","furigana":"ちずをみる。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"準備","reading":"じゅんび","meaning":"preparation","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"会議の準備をする。","en":"I prepare for the meeting.","furigana":"かいぎのじゅんびをする。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"案内","reading":"あんない","meaning":"guidance / showing around","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"駅まで案内します。","en":"I''ll show you to the station.","furigana":"えきまであんないします。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"急ぐ","reading":"いそぐ","meaning":"to hurry","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"電車に乗るために急ぐ。","en":"I hurry to catch the train.","furigana":"でんしゃにのるためにいそぐ。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000005', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"故障","reading":"こしょう","meaning":"breakdown / malfunction","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"車が故障した。","en":"The car broke down.","furigana":"くるまがこしょうした。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000006', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"丁寧","reading":"ていねい","meaning":"polite / careful","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"丁寧に書く。","en":"To write carefully.","furigana":"ていねいにかく。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000007', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"経験","reading":"けいけん","meaning":"experience","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"いい経験になった。","en":"It was a good experience.","furigana":"いいけいけんになった。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000008', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"場所","reading":"ばしょ","meaning":"place / location","partOfSpeech":"noun","exampleSentences":[{"ja":"いい場所を見つけた。","en":"I found a good place.","furigana":"いいばしょをみつけた。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000009', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"心配","reading":"しんぱい","meaning":"worry / concern","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"心配しないで。","en":"Don''t worry.","furigana":"しんぱいしないで。"}]}'::jsonb),
  ('a0000004-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000004', 'vocabulary', 'comprehension', 'N4',
   '{"word":"答える","reading":"こたえる","meaning":"to answer","partOfSpeech":"verb (ichidan)","exampleSentences":[{"ja":"質問に答える。","en":"To answer a question.","furigana":"しつもんにこたえる。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── N3 Vocabulary ─────────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('a0000003-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"確認","reading":"かくにん","meaning":"confirmation / verification","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"内容を確認してください。","en":"Please confirm the contents.","furigana":"ないようをかくにんしてください。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"記録","reading":"きろく","meaning":"record","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"新記録を出した。","en":"I set a new record.","furigana":"しんきろくをだした。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"印象","reading":"いんしょう","meaning":"impression","partOfSpeech":"noun","exampleSentences":[{"ja":"いい印象を持った。","en":"I had a good impression.","furigana":"いいいんしょうをもった。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"普通","reading":"ふつう","meaning":"ordinary / usual","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"普通の日でした。","en":"It was an ordinary day.","furigana":"ふつうのひでした。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000005', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"似合う","reading":"にあう","meaning":"to suit / to look good on","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"その色が似合う。","en":"That color suits you.","furigana":"そのいろがにあう。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000006', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"締め切り","reading":"しめきり","meaning":"deadline","partOfSpeech":"noun","exampleSentences":[{"ja":"締め切りに間に合う。","en":"To make the deadline.","furigana":"しめきりにまにあう。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000007', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"目的","reading":"もくてき","meaning":"purpose / goal","partOfSpeech":"noun","exampleSentences":[{"ja":"勉強の目的は何ですか。","en":"What is the purpose of studying?","furigana":"べんきょうのもくてきはなんですか。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000008', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"我慢","reading":"がまん","meaning":"endurance / patience","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"痛みを我慢する。","en":"To endure the pain.","furigana":"いたみをがまんする。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000009', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"発表","reading":"はっぴょう","meaning":"announcement / presentation","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"研究の発表をする。","en":"To give a research presentation.","furigana":"けんきゅうのはっぴょうをする。"}]}'::jsonb),
  ('a0000003-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000003', 'vocabulary', 'comprehension', 'N3',
   '{"word":"反対","reading":"はんたい","meaning":"opposite / opposition","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"その意見に反対する。","en":"I oppose that opinion.","furigana":"そのいけんにはんたいする。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── N2 Vocabulary ─────────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('a0000002-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"傾向","reading":"けいこう","meaning":"tendency / trend","partOfSpeech":"noun","exampleSentences":[{"ja":"忘れがちな傾向がある。","en":"I tend to forget things.","furigana":"わすれがちなけいこうがある。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"延期","reading":"えんき","meaning":"postponement","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"会議が延期された。","en":"The meeting was postponed.","furigana":"かいぎがえんきされた。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"効果","reading":"こうか","meaning":"effect / result","partOfSpeech":"noun","exampleSentences":[{"ja":"薬の効果が出た。","en":"The medicine took effect.","furigana":"くすりのこうかがでた。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"改善","reading":"かいぜん","meaning":"improvement","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"プロセスを改善する。","en":"To improve the process.","furigana":"プロセスをかいぜんする。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000005', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"豊富","reading":"ほうふ","meaning":"abundant","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"経験が豊富だ。","en":"To have abundant experience.","furigana":"けいけんがほうふだ。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000006', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"取り組む","reading":"とりくむ","meaning":"to tackle / to engage in","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"問題に取り組む。","en":"To tackle the problem.","furigana":"もんだいにとりくむ。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000007', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"当然","reading":"とうぜん","meaning":"natural / of course","partOfSpeech":"adverb / na-adjective","exampleSentences":[{"ja":"当然の結果だ。","en":"It''s a natural outcome.","furigana":"とうぜんのけっかだ。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000008', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"姿勢","reading":"しせい","meaning":"posture / attitude","partOfSpeech":"noun","exampleSentences":[{"ja":"前向きな姿勢が大切だ。","en":"A positive attitude is important.","furigana":"まえむきなしせいがたいせつだ。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000009', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"確実","reading":"かくじつ","meaning":"certain / reliable","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"確実な情報が必要だ。","en":"Reliable information is needed.","furigana":"かくじつなじょうほうがひつようだ。"}]}'::jsonb),
  ('a0000002-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000002', 'vocabulary', 'comprehension', 'N2',
   '{"word":"独立","reading":"どくりつ","meaning":"independence","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"会社から独立した。","en":"I became independent from the company.","furigana":"かいしゃからどくりつした。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── N1 Vocabulary ─────────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('a0000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"是非","reading":"ぜひ","meaning":"by all means / certainly","partOfSpeech":"adverb","exampleSentences":[{"ja":"是非来てください。","en":"Please come, by all means.","furigana":"ぜひきてください。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000002', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"曖昧","reading":"あいまい","meaning":"ambiguous / vague","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"曖昧な答えだった。","en":"It was a vague answer.","furigana":"あいまいなこたえだった。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000003', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"頻繁","reading":"ひんぱん","meaning":"frequent","partOfSpeech":"na-adjective","exampleSentences":[{"ja":"頻繁に連絡を取る。","en":"To keep in frequent contact.","furigana":"ひんぱんにれんらくをとる。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000004', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"妥協","reading":"だきょう","meaning":"compromise","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"両者が妥協した。","en":"Both sides compromised.","furigana":"りょうしゃがだきょうした。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000005', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"懸念","reading":"けねん","meaning":"concern / apprehension","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"安全を懸念する。","en":"To be concerned about safety.","furigana":"あんぜんをけねんする。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000006', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"普及","reading":"ふきゅう","meaning":"spread / diffusion","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"スマホが普及した。","en":"Smartphones became widespread.","furigana":"スマホがふきゅうした。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000007', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"冗談","reading":"じょうだん","meaning":"joke","partOfSpeech":"noun","exampleSentences":[{"ja":"冗談を言わないで。","en":"Don''t joke around.","furigana":"じょうだんをいわないで。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000008', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"逆らう","reading":"さからう","meaning":"to go against / to defy","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"風に逆らって歩く。","en":"To walk against the wind.","furigana":"かぜにさからってあるく。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000009', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"威厳","reading":"いげん","meaning":"dignity / majesty","partOfSpeech":"noun","exampleSentences":[{"ja":"威厳のある態度だ。","en":"It''s a dignified attitude.","furigana":"いげんのあるたいどだ。"}]}'::jsonb),
  ('a0000001-0000-4000-8000-000000000010', '11111111-1111-4111-8111-000000000001', 'vocabulary', 'comprehension', 'N1',
   '{"word":"模倣","reading":"もほう","meaning":"imitation","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"芸術家を模倣する。","en":"To imitate the artist.","furigana":"げいじゅつかをもほうする。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Grammar (mixed JLPT levels in one deck) ──────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('b0000001-0000-4000-8000-000000000001', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N5',
   '{"word":"〜ます","reading":"ます","meaning":"polite verb ending (non-past)","partOfSpeech":"auxiliary","exampleSentences":[{"ja":"日本語を勉強します。","en":"I study Japanese.","furigana":"にほんごをべんきょうします。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000002', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N5',
   '{"word":"〜は〜です","reading":"はです","meaning":"X is Y (topic + identity)","partOfSpeech":"pattern","exampleSentences":[{"ja":"私は学生です。","en":"I am a student.","furigana":"わたしはがくせいです。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000003', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N4',
   '{"word":"〜たことがある","reading":"たことがある","meaning":"have done (experience)","partOfSpeech":"pattern","exampleSentences":[{"ja":"日本に行ったことがある。","en":"I have been to Japan.","furigana":"にほんにいったことがある。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000004', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N4',
   '{"word":"〜ながら","reading":"ながら","meaning":"while doing (simultaneous)","partOfSpeech":"pattern","exampleSentences":[{"ja":"音楽を聞きながら勉強する。","en":"I study while listening to music.","furigana":"おんがくをききながらべんきょうする。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000005', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N3',
   '{"word":"〜ばかり","reading":"ばかり","meaning":"only / nothing but","partOfSpeech":"particle","exampleSentences":[{"ja":"テレビばかり見る。","en":"I do nothing but watch TV.","furigana":"テレビばかりみる。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000006', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N3',
   '{"word":"〜らしい","reading":"らしい","meaning":"seems / I hear that","partOfSpeech":"auxiliary","exampleSentences":[{"ja":"明日は雨らしい。","en":"It seems it''ll rain tomorrow.","furigana":"あしたはあめらしい。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000007', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N2',
   '{"word":"〜にもかかわらず","reading":"にもかかわらず","meaning":"in spite of / despite","partOfSpeech":"pattern","exampleSentences":[{"ja":"雨にもかかわらず行った。","en":"We went despite the rain.","furigana":"あめにもかかわらずいった。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000008', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N2',
   '{"word":"〜どころか","reading":"どころか","meaning":"far from / let alone","partOfSpeech":"pattern","exampleSentences":[{"ja":"勝つどころか参加もできなかった。","en":"Far from winning, I couldn''t even participate.","furigana":"かつどころかさんかもできなかった。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000009', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N1',
   '{"word":"〜とはいえ","reading":"とはいえ","meaning":"although / nevertheless","partOfSpeech":"pattern","exampleSentences":[{"ja":"春とはいえまだ寒い。","en":"It''s spring, yet still cold.","furigana":"はるとはいえまださむい。"}]}'::jsonb),
  ('b0000001-0000-4000-8000-000000000010', '22222222-2222-4222-8222-000000000001', 'grammar', 'comprehension', 'N1',
   '{"word":"〜ずにはいられない","reading":"ずにはいられない","meaning":"can''t help but","partOfSpeech":"pattern","exampleSentences":[{"ja":"笑わずにはいられなかった。","en":"I couldn''t help laughing.","furigana":"わらわずにはいられなかった。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Joyo Kanji Grade 1–6 ──────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('c0000001-0000-4000-8000-000000000001', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"一","reading":"いち","meaning":"one","partOfSpeech":"numeral","exampleSentences":[{"ja":"一人で行く。","en":"I go alone.","furigana":"ひとりでいく。"}],"kanjiBreakdown":[{"kanji":"一","meaning":"one"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000002', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"日","reading":"ひ / にち","meaning":"day / sun","partOfSpeech":"noun","exampleSentences":[{"ja":"今日はいい日だ。","en":"Today is a good day.","furigana":"きょうはいいひだ。"}],"kanjiBreakdown":[{"kanji":"日","meaning":"sun, day"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000003', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"月","reading":"つき / げつ","meaning":"moon / month","partOfSpeech":"noun","exampleSentences":[{"ja":"月がきれいだ。","en":"The moon is beautiful.","furigana":"つきがきれいだ。"}],"kanjiBreakdown":[{"kanji":"月","meaning":"moon, month"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000004', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"山","reading":"やま","meaning":"mountain","partOfSpeech":"noun","exampleSentences":[{"ja":"山に登る。","en":"To climb a mountain.","furigana":"やまにのぼる。"}],"kanjiBreakdown":[{"kanji":"山","meaning":"mountain"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000005', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"川","reading":"かわ","meaning":"river","partOfSpeech":"noun","exampleSentences":[{"ja":"川を渡る。","en":"To cross a river.","furigana":"かわをわたる。"}],"kanjiBreakdown":[{"kanji":"川","meaning":"river"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000006', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"人","reading":"ひと / じん","meaning":"person","partOfSpeech":"noun","exampleSentences":[{"ja":"あの人を知っている。","en":"I know that person.","furigana":"あのひとをしっている。"}],"kanjiBreakdown":[{"kanji":"人","meaning":"person"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000007', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N5',
   '{"word":"年","reading":"とし / ねん","meaning":"year","partOfSpeech":"noun","exampleSentences":[{"ja":"今年は忙しい。","en":"This year is busy.","furigana":"ことしはいそがしい。"}],"kanjiBreakdown":[{"kanji":"年","meaning":"year"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000008', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N4',
   '{"word":"道","reading":"みち / どう","meaning":"road / way","partOfSpeech":"noun","exampleSentences":[{"ja":"道に迷った。","en":"I got lost.","furigana":"みちにまよった。"}],"kanjiBreakdown":[{"kanji":"道","meaning":"road, way"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000009', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N4',
   '{"word":"駅","reading":"えき","meaning":"train station","partOfSpeech":"noun","exampleSentences":[{"ja":"駅で会いましょう。","en":"Let''s meet at the station.","furigana":"えきであいましょう。"}],"kanjiBreakdown":[{"kanji":"駅","meaning":"station"}]}'::jsonb),
  ('c0000001-0000-4000-8000-000000000010', '33333333-3333-4333-8333-000000000001', 'vocabulary', 'comprehension', 'N3',
   '{"word":"運","reading":"うん","meaning":"luck / fortune","partOfSpeech":"noun","exampleSentences":[{"ja":"運がいい。","en":"To be lucky.","furigana":"うんがいい。"}],"kanjiBreakdown":[{"kanji":"運","meaning":"carry, luck"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── Beyond JLPT Core ──────────────────────────────────────────────────────────
INSERT INTO cards (id, premade_deck_id, layout_type, card_type, jlpt_level, fields_data)
VALUES
  ('d0000001-0000-4000-8000-000000000001', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"侘び寂び","reading":"わびさび","meaning":"aesthetic of imperfect, transient beauty","partOfSpeech":"noun","exampleSentences":[{"ja":"日本文化の侘び寂びを学ぶ。","en":"To study the wabi-sabi of Japanese culture.","furigana":"にほんぶんかのわびさびをまなぶ。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000002', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"忖度","reading":"そんたく","meaning":"reading between the lines / surmising another''s intent","partOfSpeech":"noun (suru)","exampleSentences":[{"ja":"上司の意向を忖度する。","en":"To read the boss''s intent.","furigana":"じょうしのいこうをそんたくする。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000003', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"四字熟語","reading":"よじじゅくご","meaning":"four-character idiom","partOfSpeech":"noun","exampleSentences":[{"ja":"一期一会は有名な四字熟語だ。","en":"\"Ichigo ichie\" is a famous four-character idiom.","furigana":"いちごいちえはゆうめいなよじじゅくごだ。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000004', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"擬音語","reading":"ぎおんご","meaning":"onomatopoeia (sound)","partOfSpeech":"noun","exampleSentences":[{"ja":"日本語には擬音語が多い。","en":"Japanese has many onomatopoeia.","furigana":"にほんごにはぎおんごがおおい。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000005', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"幽玄","reading":"ゆうげん","meaning":"mysterious profundity (aesthetic)","partOfSpeech":"noun","exampleSentences":[{"ja":"能の幽玄な美しさ。","en":"The mysterious beauty of Noh.","furigana":"のうのゆうげんなうつくしさ。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000006', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"建前","reading":"たてまえ","meaning":"public stance (vs. honne)","partOfSpeech":"noun","exampleSentences":[{"ja":"建前と本音が違う。","en":"Public stance and true feelings differ.","furigana":"たてまえとほんねがちがう。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000007', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"本音","reading":"ほんね","meaning":"true feelings","partOfSpeech":"noun","exampleSentences":[{"ja":"本音を言ってください。","en":"Please tell me your true feelings.","furigana":"ほんねをいってください。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000008', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"頂く","reading":"いただく","meaning":"to receive (humble)","partOfSpeech":"verb (godan)","exampleSentences":[{"ja":"お土産を頂きました。","en":"I humbly received a souvenir.","furigana":"おみやげをいただきました。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000009', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"おもてなし","reading":"おもてなし","meaning":"hospitality (Japanese-style)","partOfSpeech":"noun","exampleSentences":[{"ja":"日本のおもてなしは有名だ。","en":"Japanese omotenashi is famous.","furigana":"にほんのおもてなしはゆうめいだ。"}]}'::jsonb),
  ('d0000001-0000-4000-8000-000000000010', '44444444-4444-4444-8444-000000000001', 'vocabulary', 'comprehension', 'beyond_jlpt',
   '{"word":"雑炊","reading":"ぞうすい","meaning":"rice porridge / Japanese congee","partOfSpeech":"noun","exampleSentences":[{"ja":"風邪を引いたから雑炊を食べる。","en":"I have a cold, so I eat rice porridge.","furigana":"かぜをひいたからぞうすいをたべる。"}]}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ─── Sync card_count on premade_decks ─────────────────────────────────────────
-- The card_count trigger only fires for user-owned cards (deck_id IS NOT NULL),
-- so we update premade_decks.card_count manually after seeding.
UPDATE premade_decks pd
SET card_count = (
  SELECT COUNT(*) FROM cards c WHERE c.premade_deck_id = pd.id
);

// AI service — split into per-generator modules under ./ai/ during the 2026-05
// maintainability pass (audit M3). Each generator keeps its prompt body,
// prompt-version constant, cache TTL, and Generated*Schema usage together in
// one file (the field-shapes ↔ generator coupling the "AI Prompts" rule in
// CLAUDE.md requires). Shared infra (cache read, breaker constants, interest
// helpers, the component logger) lives in ./ai/shared.ts. This file is the
// stable public surface: controllers import from "../services/ai.service.ts".

export { generateCard } from "./ai/card.ts";
export { generateDayReflection } from "./ai/day-reflection.ts";
export { generateWeakSpotDiagnosis } from "./ai/diagnosis.ts";
export { generateMnemonic } from "./ai/mnemonic.ts";
export { generateSentenceCard } from "./ai/sentence-card.ts";
export { generateSentences } from "./ai/sentences.ts";
export { generateTomoNote } from "./ai/tomo-note.ts";

/**
 * In-memory stand-in for `lib/openai.ts`. Drives the OpenAI client
 * deterministically (no network) and records the params each generator sends,
 * so AI-service unit tests can assert the prompt/model AND exercise both the
 * success and failure branches without a live key.
 *
 * Wire it into a test:
 *
 *   const ai = createOpenAIHarness()
 *   mock.module('../../lib/openai.ts', () => ai.module)
 *   beforeEach(() => ai.reset())
 *
 * Then queue a response before calling the service under test:
 *
 *   ai.queueChat({ word: '水', reading: 'みず', meaning: 'water' })
 *   ai.queueChatError(new Error('429 rate limited'))
 *
 * Note: generators call OpenAI through `withBreaker` (which uses the Redis
 * client), so a full offline run also needs `createRedisHarness()` mocked in.
 */

type ChatParams = Readonly<Record<string, unknown>>;
type ChatItem = { kind: "json"; value: unknown } | { kind: "error"; error: Error };

export interface OpenAIHarness {
	/** Drop-in replacement for the `lib/openai.ts` module exports. */
	module: { openai: unknown; openaiSemaphore: unknown };
	/** Params passed to every `chat.completions.create` call, in order. */
	chatCalls: ChatParams[];
	/** Params passed to every `embeddings.create` call, in order. */
	embeddingCalls: ChatParams[];
	/** Enqueue a successful chat payload (returned as an OpenAI JSON message). */
	queueChat: (json: unknown) => void;
	/** Enqueue a chat rejection (transport/4xx failure path). */
	queueChatError: (error: Error) => void;
	/** Enqueue an embedding vector (defaults to a 1536-dim zero vector). */
	queueEmbedding: (vector: readonly number[]) => void;
	reset: () => void;
}

export function createOpenAIHarness(): OpenAIHarness {
	const chatQueue: ChatItem[] = [];
	const embeddingQueue: number[][] = [];
	const chatCalls: ChatParams[] = [];
	const embeddingCalls: ChatParams[] = [];

	// Passthrough bulkhead — concurrency control isn't under test at the unit
	// level. Matches `Semaphore.run({ signal }, fn)` / `acquire()` shape.
	const openaiSemaphore = {
		run: <T>(_opts: unknown, fn: () => Promise<T>): Promise<T> => fn(),
		acquire: async (): Promise<() => void> => (): void => { /* no-op release */ },
	};

	const openai = {
		chat: {
			completions: {
				create: async (params: ChatParams): Promise<unknown> => {
					chatCalls.push(params);
					const item = chatQueue.shift();
					if (item === undefined) {
						throw new Error(
							"createOpenAIHarness: no chat response queued — call queueChat()/queueChatError() before exercising the generator",
						);
					}
					if (item.kind === "error")
						throw item.error;
					return { choices: [{ message: { content: JSON.stringify(item.value) } }] };
				},
			},
		},
		embeddings: {
			// Models the real API for both single-string and array `input`: returns
			// one `data` item per input element, each carrying its `index` (callers
			// like generateEmbeddingsBatch sort on it). Vectors drain from the queue,
			// defaulting to a 1536-dim zero vector.
			create: async (params: ChatParams): Promise<unknown> => {
				embeddingCalls.push(params);
				const input = (params as { input?: unknown }).input;
				const count = Array.isArray(input) ? input.length : 1;
				const data = Array.from({ length: count }, (_v, index) => ({
					index,
					embedding: embeddingQueue.shift() ?? Array.from({ length: 1536 }).fill(0),
				}));
				return { data };
			},
		},
	};

	return {
		module: { openai, openaiSemaphore },
		chatCalls,
		embeddingCalls,
		queueChat: (json) => { chatQueue.push({ kind: "json", value: json }); },
		queueChatError: (error) => { chatQueue.push({ kind: "error", error }); },
		queueEmbedding: (vector) => { embeddingQueue.push([...vector]); },
		reset: () => {
			chatQueue.length = 0;
			embeddingQueue.length = 0;
			chatCalls.length = 0;
			embeddingCalls.length = 0;
		},
	};
}

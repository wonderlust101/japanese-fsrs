"use client";

import type { GeneratedMnemonic, GeneratedSentences } from "@fsrs-japanese/shared-types";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { generateMnemonicAction, generateSentencesAction } from "../actions/cards.actions";

export function useGenerateSentences(
	cardId: string,
): UseMutationResult<GeneratedSentences, Error, number | undefined> {
	return useMutation({
		mutationFn: (count?: number) => generateSentencesAction(cardId, count),
	});
}

export function useGenerateMnemonic(
	cardId: string,
): UseMutationResult<GeneratedMnemonic, Error, void> {
	return useMutation({
		mutationFn: () => generateMnemonicAction(cardId),
	});
}

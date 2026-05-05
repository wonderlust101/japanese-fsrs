'use client'

import { useMutation, type UseMutationResult } from '@tanstack/react-query'

import { generateSentencesAction, generateMnemonicAction } from '../actions/cards.actions'
import type { GeneratedSentences, GeneratedMnemonic } from '@fsrs-japanese/shared-types'

export function useGenerateSentences(
  cardId: string,
): UseMutationResult<GeneratedSentences, Error, number | undefined> {
  return useMutation({
    mutationFn: (count?: number) => generateSentencesAction(cardId, count),
  })
}

export function useGenerateMnemonic(
  cardId: string,
): UseMutationResult<GeneratedMnemonic, Error, void> {
  return useMutation({
    mutationFn: () => generateMnemonicAction(cardId),
  })
}

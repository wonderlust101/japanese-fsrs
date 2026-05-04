'use client'

import { useMutation, type UseMutationResult } from '@tanstack/react-query'

import {
  generateSentencesAction,
  generateMnemonicAction,
  type RegeneratedSentences,
  type RegeneratedMnemonic,
} from '../actions/cards.actions'

export function useGenerateSentences(
  cardId: string,
): UseMutationResult<RegeneratedSentences, Error, number | undefined> {
  return useMutation({
    mutationFn: (count?: number) => generateSentencesAction(cardId, count),
  })
}

export function useGenerateMnemonic(
  cardId: string,
): UseMutationResult<RegeneratedMnemonic, Error, void> {
  return useMutation({
    mutationFn: () => generateMnemonicAction(cardId),
  })
}

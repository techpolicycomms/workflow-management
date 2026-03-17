import { baseLocale, type LocaleDictionary } from './index'

function keysOf(record: Record<string, unknown>): string[] {
  return Object.keys(record).sort()
}

export interface TranslationValidationResult {
  isValid: boolean
  missingUIKeys: string[]
  extraUIKeys: string[]
  missingStatusKeys: string[]
  extraStatusKeys: string[]
}

export function validateLocaleDictionary(candidate: LocaleDictionary): TranslationValidationResult {
  const baseUI = keysOf(baseLocale.ui as Record<string, unknown>)
  const candidateUI = keysOf(candidate.ui as Record<string, unknown>)
  const baseStatus = keysOf(baseLocale.statusLabels as Record<string, unknown>)
  const candidateStatus = keysOf(candidate.statusLabels as Record<string, unknown>)

  const missingUIKeys = baseUI.filter((key) => !candidateUI.includes(key))
  const extraUIKeys = candidateUI.filter((key) => !baseUI.includes(key))
  const missingStatusKeys = baseStatus.filter((key) => !candidateStatus.includes(key))
  const extraStatusKeys = candidateStatus.filter((key) => !baseStatus.includes(key))

  return {
    isValid:
      missingUIKeys.length === 0 &&
      extraUIKeys.length === 0 &&
      missingStatusKeys.length === 0 &&
      extraStatusKeys.length === 0,
    missingUIKeys,
    extraUIKeys,
    missingStatusKeys,
    extraStatusKeys,
  }
}

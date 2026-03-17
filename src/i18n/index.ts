import ar from './ar.json'
import en from './en.json'
import es from './es.json'
import fr from './fr.json'
import ru from './ru.json'
import zh from './zh.json'

export type LangCode = 'ar' | 'zh' | 'en' | 'fr' | 'ru' | 'es'

export const localeDictionaries = {
  ar,
  zh,
  en,
  fr,
  ru,
  es,
} as const

export type LocaleDictionary = (typeof localeDictionaries)[LangCode]

export const baseLocale = localeDictionaries.en

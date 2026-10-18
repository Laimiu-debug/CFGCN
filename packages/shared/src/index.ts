export const GAME_IDS = ['xiyou', 'shuihu', 'sanguo', 'honglou'] as const;
export type GameId = (typeof GAME_IDS)[number];
export const LOCALES = ['zh-CN', 'zh-TW', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export type Localized<T> = Record<Locale, T>;
export type WorldDefinition = {
  id: GameId;
  number: string;
  title: Localized<string>;
  englishTitle: string;
  subtitle: Localized<string>;
  invitation: Localized<string>;
  description: Localized<string>;
  genre: Localized<string>;
  place: Localized<string>;
  features: Localized<readonly string[]>;
  accent: string;
  image: string;
};

export function isGameId(value: unknown): value is GameId {
  return GAME_IDS.includes(value as GameId);
}

export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (/^zh-(tw|hk|mo|hant)(-|$)/.test(normalized)) return 'zh-TW';
    if (/^zh(-|$)/.test(normalized)) return 'zh-CN';
    if (/^en(-|$)/.test(normalized)) return 'en';
  }
  return 'en';
}

export * from './storage';

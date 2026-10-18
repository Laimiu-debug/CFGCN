import { GAME_IDS, LOCALES, isGameId } from './index';
import type { GameId, Locale } from './index';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Traveler = {
  version: 1;
  id: string;
  name: string;
  locale: Locale;
  bookmarks: GameId[];
  visited: GameId[];
  reducedMotion: boolean;
};

export const TRAVELER_KEY = 'cfgcn:traveler:v1';
export const saveKey = (game: GameId) => `cfgcn:save:${game}:v1`;

export function browserStorage(): KeyValueStorage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function createTraveler(locale: Locale): Traveler {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: '',
    locale,
    bookmarks: [],
    visited: [],
    reducedMotion: false,
  };
}

export function readTraveler(storage: KeyValueStorage | undefined, fallback: Locale): Traveler {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(TRAVELER_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return createTraveler(fallback);
    const candidate = raw as Record<string, unknown>;
    if (candidate.version !== 1 || typeof candidate.id !== 'string' || !candidate.id)
      return createTraveler(fallback);
    const games = (value: unknown) =>
      Array.isArray(value) ? [...new Set(value.filter(isGameId))] : [];
    return {
      version: 1,
      id: candidate.id,
      name: typeof candidate.name === 'string' ? candidate.name.slice(0, 24) : '',
      locale: LOCALES.includes(candidate.locale as Locale)
        ? (candidate.locale as Locale)
        : fallback,
      bookmarks: games(candidate.bookmarks),
      visited: games(candidate.visited),
      reducedMotion: candidate.reducedMotion === true,
    };
  } catch {
    return createTraveler(fallback);
  }
}

export function writeTraveler(storage: KeyValueStorage | undefined, traveler: Traveler): boolean {
  try {
    if (!storage) return false;
    storage.setItem(TRAVELER_KEY, JSON.stringify(traveler));
    return true;
  } catch {
    return false;
  }
}

export type GameSave<T = unknown> = {
  schemaVersion: 1;
  gameId: GameId;
  savedAt: string;
  payload: T;
};

export function writeGameSave<T>(
  storage: KeyValueStorage | undefined,
  gameId: GameId,
  payload: T,
): boolean {
  try {
    if (!storage || !GAME_IDS.includes(gameId)) return false;
    const envelope: GameSave<T> = {
      schemaVersion: 1,
      gameId,
      savedAt: new Date().toISOString(),
      payload,
    };
    const json = JSON.stringify(envelope);
    if (!Object.hasOwn(JSON.parse(json), 'payload')) return false;
    if (new TextEncoder().encode(json).byteLength > 1_048_576) return false;
    storage.setItem(saveKey(gameId), json);
    return true;
  } catch {
    return false;
  }
}

export function readGameSave<T = unknown>(
  storage: KeyValueStorage | undefined,
  gameId: GameId,
): GameSave<T> | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(saveKey(gameId)) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const save = value as Record<string, unknown>;
    if (
      save.schemaVersion !== 1 ||
      save.gameId !== gameId ||
      typeof save.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(save.savedAt)) ||
      !Object.hasOwn(save, 'payload')
    )
      return null;
    return save as GameSave<T>;
  } catch {
    return null;
  }
}

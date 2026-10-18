import { describe, expect, it } from 'vitest';
import {
  detectLocale,
  readGameSave,
  readTraveler,
  saveKey,
  TRAVELER_KEY,
  writeGameSave,
  writeTraveler,
} from './index';
import type { KeyValueStorage } from './storage';

function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('visitor data resilience', () => {
  it('recovers from corrupt local data without breaking entry', () => {
    const storage = memoryStorage();
    storage.setItem(TRAVELER_KEY, '{broken');
    expect(readTraveler(storage, 'zh-CN')).toMatchObject({
      version: 1,
      locale: 'zh-CN',
      bookmarks: [],
    });
  });
  it('keeps identity and cleans unknown or duplicate world IDs', () => {
    const storage = memoryStorage();
    storage.setItem(
      TRAVELER_KEY,
      JSON.stringify({
        version: 1,
        id: 'visitor',
        locale: 'xx',
        bookmarks: ['xiyou', 'unknown', 'xiyou'],
        visited: ['honglou'],
        name: '游人',
      }),
    );
    const traveler = readTraveler(storage, 'en');
    expect(traveler).toMatchObject({
      id: 'visitor',
      locale: 'en',
      bookmarks: ['xiyou'],
      visited: ['honglou'],
    });
    expect(writeTraveler(storage, { ...traveler, name: '新名' })).toBe(true);
    expect(readTraveler(storage, 'en').name).toBe('新名');
  });
  it('degrades gracefully when the browser refuses storage', () => {
    const blocked = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('quota');
      },
    };
    const traveler = readTraveler(blocked, 'en');
    expect(traveler.id).toBeTruthy();
    expect(writeTraveler(blocked, traveler)).toBe(false);
    expect(writeTraveler(undefined, traveler)).toBe(false);
  });
});

describe('per-game save boundary', () => {
  it('isolates progress across games and preserves payloads', () => {
    const storage = memoryStorage();
    writeGameSave(storage, 'xiyou', { chapter: 3 });
    writeGameSave(storage, 'honglou', { event: '诗会' });
    expect(readGameSave<{ chapter: number }>(storage, 'xiyou')?.payload.chapter).toBe(3);
    expect(readGameSave<{ event: string }>(storage, 'honglou')?.payload.event).toBe('诗会');
    expect(readGameSave(storage, 'sanguo')).toBeNull();
  });
  it('rejects mismatched identity and future schema without altering data', () => {
    const storage = memoryStorage();
    const future = JSON.stringify({
      schemaVersion: 2,
      gameId: 'xiyou',
      savedAt: new Date().toISOString(),
      payload: {},
    });
    storage.setItem(saveKey('xiyou'), future);
    expect(readGameSave(storage, 'xiyou')).toBeNull();
    expect(storage.getItem(saveKey('xiyou'))).toBe(future);
    storage.setItem(
      saveKey('xiyou'),
      JSON.stringify({
        schemaVersion: 1,
        gameId: 'honglou',
        savedAt: new Date().toISOString(),
        payload: {},
      }),
    );
    expect(readGameSave(storage, 'xiyou')).toBeNull();
  });
  it('rejects oversized data without destroying an existing save', () => {
    const storage = memoryStorage();
    writeGameSave(storage, 'xiyou', { level: 2 });
    expect(writeGameSave(storage, 'xiyou', '字'.repeat(400_000))).toBe(false);
    expect(readGameSave(storage, 'xiyou')?.payload).toEqual({ level: 2 });
  });
  it('keeps the previous save when a payload cannot be serialized', () => {
    const storage = memoryStorage();
    writeGameSave(storage, 'shuihu', { chapter: 1 });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(writeGameSave(storage, 'shuihu', cyclic)).toBe(false);
    expect(writeGameSave(storage, 'shuihu', undefined)).toBe(false);
    expect(readGameSave(storage, 'shuihu')?.payload).toEqual({ chapter: 1 });
  });
});

describe('locale negotiation', () => {
  it('preserves supported browser language preference', () => {
    expect(detectLocale(['zh-Hant-TW', 'en'])).toBe('zh-TW');
    expect(detectLocale(['zh-HK'])).toBe('zh-TW');
    expect(detectLocale(['fr', 'zh-CN'])).toBe('zh-CN');
    expect(detectLocale(['en-US', 'zh-CN'])).toBe('en');
    expect(detectLocale(['fr'])).toBe('en');
  });
});

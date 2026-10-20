import { describe, expect, it } from 'vitest';
import {
  GAME_IDS,
  GAME_ORIGINS,
  gameForHost,
  gameHref,
  parseSiteRoute,
  portalHref,
  siteLocale,
  SITE_ORIGIN,
} from './index';

describe('fourealms domain routing', () => {
  it('passes only supported languages across official origins', () => {
    expect(gameHref('xiyou', 'fourealms.com', 'en')).toBe('https://xiyou.fourealms.com/?lang=en');
    expect(portalHref('xiyou.fourealms.com', 'zh-TW')).toBe('https://fourealms.com/?lang=zh-TW');
    expect(gameHref('xiyou', 'localhost', 'en')).toBe('#/world/xiyou');
    for (const locale of ['en', 'zh-CN', 'zh-TW'])
      expect(siteLocale(`?lang=${locale}`)).toBe(locale);
    for (const value of ['?lang=invalid', '?lang=en-script', ''])
      expect(siteLocale(value)).toBe(null);
  });
  it('opens all four games at the root of their own exact subdomain', () => {
    for (const game of GAME_IDS) {
      const hostname = new URL(GAME_ORIGINS[game]).hostname;
      expect(parseSiteRoute('', hostname)).toBe(game);
      expect(parseSiteRoute('#/', hostname)).toBe(game);
      expect(gameForHost(hostname.toUpperCase() + '.')).toBe(game);
    }
  });
  it('links production cards to the correct HTTPS origin from any official host', () => {
    for (const source of [
      new URL(SITE_ORIGIN).hostname,
      ...Object.values(GAME_ORIGINS).map((value) => new URL(value).hostname),
    ]) {
      for (const game of GAME_IDS) expect(gameHref(game, source)).toBe(`${GAME_ORIGINS[game]}/`);
    }
  });
  it('returns from a game to the portal, preserving local development navigation', () => {
    expect(portalHref('xiyou.fourealms.com')).toBe('https://fourealms.com/');
    expect(portalHref('fourealms.com')).toBe('#/');
    expect(portalHref('localhost')).toBe('#/');
    expect(gameHref('xiyou', '127.0.0.1')).toBe('#/world/xiyou');
    expect(parseSiteRoute('#/world/honglou', 'localhost')).toBe('honglou');
    expect(parseSiteRoute('', '127.0.0.1')).toBe('home');
  });
  it('rejects unknown routes and lookalike domains', () => {
    for (const hostname of [
      'xiyou.fourealms.com.evil.test',
      'notxiyou.fourealms.com',
      'unknown.fourealms.com',
    ]) {
      expect(gameForHost(hostname)).toBe(null);
      expect(gameHref('xiyou', hostname)).toBe('#/world/xiyou');
    }
    for (const hash of ['#/world/unknown', '#/world/__proto__', '#/bad'])
      expect(parseSiteRoute(hash, 'fourealms.com')).toBe('not-found');
  });
  it('keeps portal section links valid after cross-domain navigation', () => {
    expect(parseSiteRoute('#worlds', 'fourealms.com')).toBe('home');
    expect(parseSiteRoute('#our-story', 'fourealms.com')).toBe('home');
  });
});

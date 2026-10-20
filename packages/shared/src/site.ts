import type { GameId, Locale } from './index';

export const SITE_DOMAIN = 'fourealms.com';
export const SITE_ORIGIN = `https://${SITE_DOMAIN}`;
export const GAME_ORIGINS = {
  xiyou: `https://xiyou.${SITE_DOMAIN}`,
  sanguo: `https://sanguo.${SITE_DOMAIN}`,
  shuihu: `https://shuihu.${SITE_DOMAIN}`,
  honglou: `https://honglou.${SITE_DOMAIN}`,
} as const satisfies Record<GameId, string>;
export type SiteRoute = GameId | 'home' | 'not-found';

const host = (value: string) => value.toLowerCase().replace(/\.$/, '');
export function gameForHost(hostname: string): GameId | null {
  const current = host(hostname);
  return (
    (Object.keys(GAME_ORIGINS) as GameId[]).find(
      (game) => new URL(GAME_ORIGINS[game]).hostname === current,
    ) ?? null
  );
}
function publicHost(hostname: string): boolean {
  return host(hostname) === SITE_DOMAIN || gameForHost(hostname) !== null;
}
const language = (locale?: Locale) => (locale ? `?lang=${encodeURIComponent(locale)}` : '');
export function gameHref(game: GameId, hostname: string, locale?: Locale): string {
  return publicHost(hostname) ? `${GAME_ORIGINS[game]}/${language(locale)}` : `#/world/${game}`;
}
export function portalHref(hostname: string, locale?: Locale): string {
  return gameForHost(hostname) ? `${SITE_ORIGIN}/${language(locale)}` : '#/';
}
export function siteLocale(search: string): Locale | null {
  const locale = new URLSearchParams(search).get('lang');
  return locale === 'en' || locale === 'zh-CN' || locale === 'zh-TW' ? locale : null;
}
export function parseSiteRoute(hash: string, hostname: string): SiteRoute {
  if (['', '#', '#/', '#worlds', '#our-story'].includes(hash))
    return gameForHost(hostname) ?? 'home';
  const match = /^#\/world\/([^/]+)$/.exec(hash);
  return match && Object.hasOwn(GAME_ORIGINS, match[1]) ? (match[1] as GameId) : 'not-found';
}

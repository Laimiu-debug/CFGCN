import type { Locale, WorldDefinition } from '@cfgcn/shared';
import { portalHref } from '@cfgcn/shared';
import type { ButtonHTMLAttributes, CSSProperties } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'icon' | 'portrait' | 'choice' | 'control';
export function Button({
  variant = 'quiet',
  className = '',
  type = 'button',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || props['aria-busy'] === true || props['aria-busy'] === 'true'}
      className={`series-button series-button--${variant} ${className}`}
    />
  );
}

type IconName =
  | 'arrow'
  | 'bookmark'
  | 'book'
  | 'close'
  | 'volume'
  | 'mute'
  | 'globe'
  | 'check'
  | 'download'
  | 'sun'
  | 'leaf';
const paths: Record<IconName, string> = {
  arrow: 'M4 12h15M13 5l7 7-7 7',
  bookmark: 'M6 4h12v17l-6-4-6 4V4Z',
  book: 'M12 6c-3-2-6-2-10-1v15c4-1 7-1 10 1m0-15c3-2 6-2 10-1v15c-4-1-7-1-10 1V6Z',
  close: 'm6 6 12 12M6 18 18 6',
  volume: 'm11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  mute: 'm11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6',
  globe: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z',
  check: 'm5 12 4 4L20 5',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  leaf: 'M20 3C9 2 3 7 4 15c6 9 18 3 16-12ZM5 19 16 8',
};

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function WorldPreview({
  world,
  locale,
  bookmarked,
  onBookmark,
}: {
  world: WorldDefinition;
  locale: Locale;
  bookmarked: boolean;
  onBookmark: () => void;
}) {
  const english = locale === 'en';
  const traditional = locale === 'zh-TW';
  return (
    <main
      id="main"
      className="world-page"
      style={{ '--world-accent': world.accent } as CSSProperties}
    >
      <a className="world-back" href={portalHref(window.location.hostname, locale)}>
        <span aria-hidden="true">←</span>{' '}
        {english ? 'The four worlds' : traditional ? '返回四方天地' : '返回四方天地'}
      </a>
      <div className="world-landscape">
        <img src={world.image} alt={world.place[locale]} fetchPriority="high" />
        <div className="world-image-shade" />
      </div>
      <div className="world-intro container">
        <p className="eyebrow">
          {world.number} /{' '}
          {english
            ? 'A WORLD IN THE MAKING'
            : traditional
              ? '一卷新境 · 世界預覽'
              : '一卷新境 · 世界预览'}
        </p>
        <h1>{world.title[locale]}</h1>
        <p className="world-english">{world.englishTitle}</p>
        <p className="world-invitation">{world.invitation[locale]}</p>
        <p className="world-description">{world.description[locale]}</p>
        <Button variant="primary" className="button primary" onClick={onBookmark}>
          <Icon name={bookmarked ? 'check' : 'bookmark'} size={17} />
          {english
            ? bookmarked
              ? 'Saved to your journal'
              : 'Save this world'
            : traditional
              ? bookmarked
                ? '已記入旅人手記'
                : '記下此境'
              : bookmarked
                ? '已记入旅人手记'
                : '记下此境'}
        </Button>
      </div>
      <section
        className="world-notes container"
        aria-label={english ? 'Inside this world' : traditional ? '此境遊記' : '此境游记'}
      >
        <div>
          <span className="eyebrow">{english ? 'THE STORY AHEAD' : '此境之中'}</span>
          <h2>{world.subtitle[locale]}</h2>
          <p>
            {english
              ? 'An early look at the world we are creating. The playable adventure is still to come.'
              : traditional
                ? '這是尚在營造的世界預覽。先賞一段山河，再靜候故事開篇。'
                : '这是尚在营造的世界预览。先赏一段山河，再静候故事开篇。'}
          </p>
        </div>
        <ol>
          {world.features[locale].map((feature, index) => (
            <li key={feature}>
              <span>0{index + 1}</span>
              <p>{feature}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
